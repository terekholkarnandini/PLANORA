import React from 'react'

interface SelectionCardProps {
  title: string
  description: string
  isSelected: boolean
  onClick: () => void
  icon: React.ReactNode
}

const SelectionCard: React.FC<SelectionCardProps> = ({
  title,
  description,
  isSelected,
  onClick,
  icon,
}) => {
  return (
    <button
      type="button"
      className={`option-selection-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-icon-wrapper">{icon}</div>

      <div className="card-info">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="card-indicator" />
    </button>
  )
}

export default SelectionCard
