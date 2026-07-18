import {
  ARCHIVE_LIMITS,
  CUBE_COLORS,
  type CubeColor,
} from "@/lib/archive";
import {
  COLOR_HEX,
  COLOR_LABEL,
} from "./editorial-format";

export function ChapterFields({
  idPrefix,
  name,
  description,
  color,
  nameLabel = "챕터 이름 *",
  descriptionLabel = "짧은 설명",
  colorLabel = "분위기 색상",
  showDescription = true,
  namePlaceholder,
  descriptionPlaceholder,
  onNameChange,
  onDescriptionChange,
  onColorChange,
}: {
  idPrefix: string;
  name: string;
  description: string;
  color?: CubeColor;
  nameLabel?: string;
  descriptionLabel?: string;
  colorLabel?: string;
  showDescription?: boolean;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange?: (value: CubeColor) => void;
}) {
  const nameId = `${idPrefix}-name`;
  const descriptionId = `${idPrefix}-description`;

  return (
    <div className="form-stack" style={{ marginTop: 24 }}>
      <div className="field">
        <label htmlFor={nameId}>{nameLabel}</label>
        <input
          className="input"
          id={nameId}
          maxLength={ARCHIVE_LIMITS.cubeName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={namePlaceholder}
          value={name}
        />
      </div>
      {showDescription ? (
        <div className="field">
          <label htmlFor={descriptionId}>{descriptionLabel}</label>
          <textarea
            className="textarea"
            id={descriptionId}
            maxLength={ARCHIVE_LIMITS.cubeDescription}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={descriptionPlaceholder}
            value={description}
          />
        </div>
      ) : null}
      {color && onColorChange ? (
        <div className="field">
          <span className="field-label">{colorLabel}</span>
          <div className="filter-row">
            {CUBE_COLORS.map((item) => (
              <button
                aria-pressed={color === item}
                className={`tag${color === item ? " is-selected" : ""}`}
                key={item}
                onClick={() => onColorChange(item)}
                style={{ borderColor: COLOR_HEX[item] }}
                type="button"
              >
                {COLOR_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
