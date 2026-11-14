interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ id, label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label class="toggle-row" for={id}>
      <span class="toggle-row-text">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        {...({ switch: '' } as Record<string, string>)}
        class="prism-switch"
        checked={checked}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
    </label>
  );
}
