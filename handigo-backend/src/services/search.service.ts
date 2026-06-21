import { Category } from "../models/category.model";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import type { SearchQuery } from "../validations/search.validator";

type SearchType = "category" | "service" | "option";

interface SearchCandidate {
  id: string;
  type: SearchType;
  name: string;
  description?: string | null;
  categoryId?: string;
  serviceId?: string;
}

const normalizeText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const calculateScore = (candidate: SearchCandidate, keyword: string) => {
  const name = normalizeText(candidate.name);
  const description = normalizeText(candidate.description);

  if (name === keyword) return 100;
  if (name.startsWith(keyword)) return 90;
  if (name.includes(keyword)) return 75;
  if (description.startsWith(keyword)) return 55;
  if (description.includes(keyword)) return 45;

  const terms = keyword.split(" ");
  const searchableText = `${name} ${description}`;
  const matchedTerms = terms.filter((term) => searchableText.includes(term));
  return matchedTerms.length === terms.length ? 30 + matchedTerms.length : 0;
};

export const searchCatalog = async ({ q, limit }: SearchQuery) => {
  const keyword = normalizeText(q);
  const [categories, services, options] = await Promise.all([
    Category.find({ isActive: true, isDeleted: false })
      .select("name description")
      .lean(),
    Service.find({ isActive: true, isDeleted: false })
      .select("name description categoryId")
      .lean(),
    ServiceOption.find({ isActive: true, isDeleted: false })
      .select("name description serviceId")
      .lean(),
  ]);

  const activeServiceIds = new Set(services.map((service) => service._id.toString()));
  const candidates: SearchCandidate[] = [
    ...categories.map((category) => ({
      id: category._id.toString(),
      type: "category" as const,
      name: category.name,
      description: category.description,
    })),
    ...services.map((service) => ({
      id: service._id.toString(),
      type: "service" as const,
      name: service.name,
      description: service.description,
      categoryId: service.categoryId.toString(),
    })),
    ...options
      .filter((option) => activeServiceIds.has(option.serviceId.toString()))
      .map((option) => ({
        id: option._id.toString(),
        type: "option" as const,
        name: option.name,
        description: option.description,
        serviceId: option.serviceId.toString(),
      })),
  ];

  return candidates
    .map((candidate) => ({ ...candidate, score: calculateScore(candidate, keyword) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "vi"))
    .slice(0, limit)
    .map(({ score: _score, ...candidate }) => candidate);
};
