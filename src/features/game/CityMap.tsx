"use client";
import { useId } from "react";
import type { CityMapProps } from "@/shared/ports";
import { directionLabels, formatNumber } from "./labels";
import styles from "./game.module.css";
import mapStyles from "./city-map.module.css";

const areas = [
  { path: "M42 48 L274 30 L360 154 L284 229 L59 196 Z", x: 174, y: 128,
    roads: "M47 166 L324 187 M88 44 L115 207 M191 32 L217 224 M281 46 L308 191",
    lanes: "M56 88 L313 112 M137 36 L155 217 M244 42 L265 228",
    blocks: [[113,58,28,27],[151,58,30,35],[215,49,25,29],[260,51,20,18],[65,121,28,33],[119,180,33,18],[160,178,40,27],[224,178,28,29],[263,185,24,21],[304,128,25,36]] },
  { path: "M59 211 L279 245 L356 175 L417 278 L276 358 L73 320 Z", x: 212, y: 283,
    roads: "M61 266 L381 243 M116 214 L145 345 M253 231 L279 357 M322 200 L343 316",
    lanes: "M70 307 L398 282 M181 229 L198 347 M362 214 L379 290",
    blocks: [[75,222,25,30],[147,229,23,25],[81,281,31,19],[154,316,30,23],[205,322,44,18],[280,250,29,21],[288,302,34,20],[334,228,23,14],[353,266,21,21],[375,245,24,23]] },
  { path: "M81 337 L276 376 L431 296 L488 416 L292 492 L109 461 Z", x: 245, y: 430,
    roads: "M97 390 L461 349 M117 452 L475 411 M199 352 L226 483 M314 349 L341 476 M405 320 L426 453",
    lanes: "M151 347 L177 473 M260 373 L282 489 M107 420 L476 383",
    blocks: [[109,349,31,25],[154,363,24,18],[113,399,29,31],[145,432,24,16],[176,451,27,24],[224,376,30,20],[269,395,34,16],[276,454,41,22],[355,441,31,22],[428,342,21,29],[437,382,29,26]] }
];
const river = "M358 -20 C295 50 454 88 403 172 S422 271 484 306 S476 468 555 538";

function Park({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width={width} height={height} rx="9" className={mapStyles.park} />
    <path d={`M8 ${height - 8} Q${width / 2} 5 ${width - 7} 10`} className={mapStyles.parkPath} />
    {[[10,10],[width - 13,height - 12],[width / 2,height - 10]].map(([cx, cy], index) => <g key={index}><circle cx={cx} cy={cy + 2} r="6" className={mapStyles.treeShadow} /><circle cx={cx} cy={cy} r="5" className={mapStyles.tree} /></g>)}
  </g>;
}

export function CityMap({ districts, selectedDistrictId, preview, onSelectDistrict }: CityMapProps) {
  const mapId = useId();
  const selected = districts.find(d => d.id === selectedDistrictId);
  const after = preview?.districts.find(d => d.districtId === selectedDistrictId)?.after;
  return <section aria-labelledby={`${mapId}-title`} className={mapStyles.panel}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / Территория</p><h2 id={`${mapId}-title`}>Начните с района</h2></div><span className={styles.tag}>Условная карта</span></div>
    <svg className={mapStyles.map} viewBox="0 0 540 530" role="group" aria-label="Выбор района на карте">
      <title>Три условных района города</title>
      <defs aria-hidden="true">{areas.map((area, index) => <clipPath key={index} id={`${mapId}-area-${index}`}><path d={area.path} /></clipPath>)}</defs>
      <g aria-hidden="true" className={mapStyles.decorative}>
        <path d="M0 82 H540 M0 186 H540 M0 290 H540 M0 394 H540 M0 498 H540 M48 0 V530 M152 0 V530 M256 0 V530 M360 0 V530 M464 0 V530" className={mapStyles.grid} />
        <path d={river} className={mapStyles.riverBank} /><path d={river} className={mapStyles.river} /><path d={river} className={mapStyles.waterLine} />
        <path d="M340 -6 C276 57 435 96 385 173 S404 282 468 316 S458 480 537 541" className={mapStyles.embankment} />
      </g>
      {districts.map((district, index) => {
        const area = areas[index]; if (!area) return null;
        const isSelected = district.id === selectedDistrictId;
        return <g key={district.id} role="button" tabIndex={0} aria-label={`${district.name} район`} aria-pressed={isSelected}
          className={`${mapStyles.district} ${isSelected ? mapStyles.selectedDistrict : ""}`}
          onClick={() => onSelectDistrict(district.id)} onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDistrict(district.id); }
          }}>
          <path className={mapStyles.districtShape} d={area.path} />
          <g aria-hidden="true" className={mapStyles.decorative} clipPath={`url(#${mapId}-area-${index})`}>
            <path d={area.lanes} className={mapStyles.minorRoad} />
            <path d={area.roads} className={mapStyles.roadEdge} /><path d={area.roads} className={mapStyles.road} />
            {area.blocks.map(([x,y,width,height], block) => <g key={block}><rect x={x} y={y + 2} width={width} height={height} rx="2" className={mapStyles.buildingShadow} /><rect x={x} y={y} width={width} height={height} rx="2" className={mapStyles.building} /><path d={`M${x + 4} ${y + 4} H${x + width - 4}`} className={mapStyles.roof} /></g>)}
            {index === 0 && <><Park x={227} y={86} width={64} height={55} /><Park x={54} y={63} width={40} height={47} /><g transform="translate(114 71)" className={mapStyles.landmark}><rect x="-10" y="-10" width="20" height="20" rx="5" /><path d="M-5 -5 H5 V4 H-5 Z M-5 -1 H5 M-3 4 V7 M3 4 V7" /><text x="0" y="26">Остановка</text></g></>}
            {index === 1 && <><Park x={282} y={274} width={43} height={28} /><g transform="translate(108 231)" className={mapStyles.landmark}><rect x="-11" y="-12" width="22" height="22" rx="5" /><path d="M-7 -4 L0 -9 7 -4 M-6 -3 V5 M0 -3 V5 M6 -3 V5 M-8 6 H8" /><text x="0" y="26">Площадь</text></g></>}
            {index === 2 && <><Park x={346} y={372} width={66} height={53} /><Park x={109} y={360} width={40} height={23} /><g transform="translate(175 374)" className={mapStyles.landmark}><rect x="-12" y="-12" width="24" height="22" rx="5" /><path d="M-8 5 V-4 L0 -8 8 -4 V5 Z M-3 5 V0 H3 V5 M-4 -3 H-2 M2 -3 H4" /><text x="0" y="26">Школа</text></g></>}
          </g>
          <g aria-hidden="true" className={mapStyles.decorative} transform={`translate(${area.x} ${area.y})`}>
            <rect x="-92" y="-20" width="184" height="54" rx="9" className={mapStyles.labelPlate} />
            <text y="2" textAnchor="middle" className={mapStyles.mapLabel}>{district.name}</text>
            <text y="22" textAnchor="middle" className={mapStyles.mapHint}>{isSelected ? "✓ Выбранный район" : "Выбрать район"}</text>
          </g>
        </g>;
      })}
      <g aria-hidden="true" className={mapStyles.decorative}>
        <path d="M367 194 L437 214 M464 382 L523 361" className={mapStyles.bridgeEdge} /><path d="M367 194 L437 214 M464 382 L523 361" className={mapStyles.bridge} /><path d="M367 194 L437 214 M464 382 L523 361" className={mapStyles.bridgeLane} />
        <g transform="translate(484 58)"><circle r="24" className={mapStyles.compassPlate} /><text y="-6" textAnchor="middle" className={mapStyles.compass}>С</text><path d="M0 1 V15 M-5 6 0 0 5 6" className={mapStyles.compassArrow} /></g>
        <text x="430" y="120" transform="rotate(64 430 120)" className={mapStyles.riverLabel}>Набережная</text>
        <path d="M34 497 H93 M34 492 V502 M93 492 V502" className={mapStyles.scale} /><text x="34" y="516" className={mapStyles.mapNote}>Схема без масштаба</text>
      </g>
    </svg>
    <div className={mapStyles.legend} aria-label="Обозначения карты"><span><i className={mapStyles.parkKey} aria-hidden="true" />Парки</span><span><i className={mapStyles.blockKey} aria-hidden="true" />Кварталы</span><span><i className={mapStyles.waterKey} aria-hidden="true" />Вода</span><span><i className={mapStyles.selectedKey} aria-hidden="true" />Выбранный район</span></div>
    <p className={mapStyles.disclaimer}>Условная схема: улицы и ориентиры придуманы. Это не географическая карта Астаны.</p>
    <p className={styles.small}>Выберите район на карте. С клавиатуры: Tab, затем Enter или пробел.</p>
    {selected && <div className={styles.metrics} aria-label={`Показатели: ${selected.name}`}>
      <h3>{selected.name} <span>· индексы качества / 100</span></h3>
      {Object.entries(selected.baseline).map(([key, value]) => <div key={key} className={styles.metricRow}>
        <span>{directionLabels[key as keyof typeof directionLabels]}</span>
        <meter min={0} max={100} value={after?.[key as keyof typeof after] ?? value} aria-label={`${directionLabels[key as keyof typeof directionLabels]}: ${selected.name}`} />
        <strong>{formatNumber(value)}{after && <> → {formatNumber(after[key as keyof typeof after])}</>}</strong>
      </div>)}
      <p className={styles.small}>{after ? "До → после выбранных мероприятий" : "Исходные показатели. Прогноз появится после подключения расчёта."}</p>
    </div>}
  </section>;
}
