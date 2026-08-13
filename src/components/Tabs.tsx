type TabItem = {
  id: string
  label: string
}

type Props = {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, value, onChange }: Props) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          role="tab"
          data-active={tab.id === value}
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
