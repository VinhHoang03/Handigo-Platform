import { AppError } from "../../utils/appError";
import { loadAgentConfig } from "../ai.config";
import { registerTools } from "../tools/register-tools";
import { ReadOnlyAgentRuntime } from "./agent-runtime";
import { createPersistentGraphConnection } from "./mongo-graph-access";
import type { GraphSessionHost } from "./agent-facade";
import type { CustomerGraphHost } from "./agent-facade";
import { createCustomerGraphConnection } from "./customer-graph-connection";
import { CustomerWorkflowRuntime } from "./customer-workflow-runtime";
import { mergeAgentOrderMessages } from "../../services/agentOrderProgress.service";
import { observeCustomerTurn } from "./customer-runtime-metrics";

let connection: ReturnType<typeof createPersistentGraphConnection> | undefined;
let opening: Promise<GraphSessionHost> | undefined;
let customerConnection: ReturnType<typeof createCustomerGraphConnection> | undefined;
let customerOpening: Promise<CustomerGraphHost> | undefined;

export function getCustomerGraphHost(): Promise<CustomerGraphHost> {
  if (!customerOpening) {
    customerOpening = (async (): Promise<CustomerGraphHost> => {
      const uri = process.env.MONGO_URI;
      if (!uri) throw new AppError("Kho engine nghiệp vụ chưa được cấu hình.", 503);
      customerConnection = createCustomerGraphConnection(uri);
      await customerConnection.open();
      const opened = customerConnection;
      const runtime = () => {
        const config = loadAgentConfig();
        return new CustomerWorkflowRuntime({ config, registry: registerTools(config.tools), provider: config.createProvider(),
          access: opened.access, checkpointer: opened.saver, ledger: opened.ledger, assertWriteAccess: opened.assertWriteAccess });
      };
      return {
        exclusive: (user, id, run) => opened.access.exclusive(user, id, () => run()),
        get: async (id, userId) => mergeAgentOrderMessages(await opened.get(id, userId)),
        send: (user, id, input) => observeCustomerTurn(() => runtime().send(user, id, input)),
        requireAttachmentSupport: (user, id) => runtime().requireAttachmentSupport(user, id),
        registerAttachment: (user, id, url) => runtime().registerAttachment(user, id, url),
      };
    })().catch((error: unknown) => { customerOpening = undefined; customerConnection = undefined; throw error; });
  }
  return customerOpening;
}

// Mở lười khi cần phiên graph; request thông thường không tự tạo collection/index.
export function getGraphHost(): Promise<GraphSessionHost> {
  if (!opening) {
    opening = (async (): Promise<GraphSessionHost> => {
      const uri = process.env.MONGO_URI;
      if (!uri) throw new AppError("Kho phiên graph chưa được cấu hình.", 503);
      connection = createPersistentGraphConnection(uri);
      await connection.open();
      const opened = connection;
      return {
        exclusive: (user, id, run) => opened.access.exclusive(user, id, () => run()),
        get: (id, userId) => opened.get(id, userId),
        async send(user, id, input) {
          const config = loadAgentConfig();
          return new ReadOnlyAgentRuntime({ provider: config.createProvider(), registry: registerTools(config.tools),
            checkpointer: opened.saver, maxIterations: Math.min(config.maxIterations, 12) }, opened.access).send(user, id, input);
        },
      };
    })().catch((error: unknown) => { opening = undefined; connection = undefined; throw error; });
  }
  return opening;
}

export async function closeGraphHost() {
  if (customerOpening) await customerOpening.catch(() => undefined);
  await customerConnection?.close();
  customerConnection = undefined;
  customerOpening = undefined;
  if (opening) await opening.catch(() => undefined);
  await connection?.close();
  connection = undefined;
  opening = undefined;
}
