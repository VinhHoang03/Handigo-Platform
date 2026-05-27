interface ToggleSwitchProps {
  defaultChecked?: boolean;
}

export const ToggleSwitch = ({ defaultChecked = false }: ToggleSwitchProps) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input defaultChecked={defaultChecked} className="sr-only peer" type="checkbox" />
    <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
  </label>
);
