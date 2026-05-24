type ManualTabProps = {
  pointName: string
  latitude: string
  longitude: string
  onPointNameChange: (value: string) => void
  onLatitudeChange: (value: string) => void
  onLongitudeChange: (value: string) => void
}

export const ManualTab = ({
  pointName,
  latitude,
  longitude,
  onPointNameChange,
  onLatitudeChange,
  onLongitudeChange,
}: ManualTabProps) => (
  <div className="tab-panel">
    <form className="manual-form" onSubmit={(event) => event.preventDefault()}>
      <p className="manual-hint">Добавление именованной точки в Блокнот картографа</p>
      <label htmlFor="point-name">Название точки</label>
      <input
        id="point-name"
        type="text"
        placeholder="Моя точка"
        value={pointName}
        onChange={(event) => onPointNameChange(event.target.value)}
        autoComplete="off"
      />
      <label htmlFor="latitude">Широта</label>
      <input
        id="latitude"
        type="text"
        inputMode="decimal"
        placeholder="55.123456"
        value={latitude}
        onChange={(event) => onLatitudeChange(event.target.value)}
        autoComplete="off"
      />
      <label htmlFor="longitude">Долгота</label>
      <input
        id="longitude"
        type="text"
        inputMode="decimal"
        placeholder="37.123456"
        value={longitude}
        onChange={(event) => onLongitudeChange(event.target.value)}
        autoComplete="off"
      />
    </form>
  </div>
)
