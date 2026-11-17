import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getPlayerClass } from '../data/classes';
import { getSwordCombo } from '../data/swordSkills';
import { WEAPONS } from '../data/weapons';
import { useGameStore } from '../store/useGameStore';

const SLOT_CODE: Record<string, string> = {
  m9: 'M9',
  striker: 'STK',
  marauder: 'MRD',
  breaker: 'BRK',
  longbow: 'LBW',
  graviton: 'GRV',
  vantage: 'VTG',
  sovereign: 'SVG',
  kurogane: 'KRG',
  raijin: 'RAI',
};

function pad(value: number) {
  return value < 10 ? `0${value}` : String(value);
}

export function Hud() {
  const phase = useGameStore((s) => s.phase);
  const paused = useGameStore((s) => s.paused);
  const hp = useGameStore((s) => s.hp);
  const wave = useGameStore((s) => s.wave);
  const kills = useGameStore((s) => s.kills);
  const earned = useGameStore((s) => s.earned);
  const enemiesLeft = useGameStore((s) => s.enemiesLeft);
  const ammo = useGameStore((s) => s.ammo);
  const reserve = useGameStore((s) => s.reserve);
  const reloading = useGameStore((s) => s.reloading);
  const ads = useGameStore((s) => s.ads);
  const equipped = useGameStore((s) => s.equipped);
  const owned = useGameStore((s) => s.owned);
  const medkits = useGameStore((s) => s.medkits);
  const feed = useGameStore((s) => s.feed);
  const hitTick = useGameStore((s) => s.hitTick);
  const headshotTick = useGameStore((s) => s.headshotTick);
  const damageTick = useGameStore((s) => s.damageTick);
  const upgrades = useGameStore((s) => s.upgrades);
  const perkHp = useGameStore((s) => s.perks.hp);
  const guardianUsed = useGameStore((s) => s.guardianUsed);
  const guardianTick = useGameStore((s) => s.guardianTick);
  const classId = useGameStore((s) => s.classId);
  const skillReadyAt = useGameStore((s) => s.skillReadyAt);
  const skillTick = useGameStore((s) => s.skillTick);
  const skillCastUntil = useGameStore((s) => s.skillCastUntil);
  const swordReadyAt = useGameStore((s) => s.swordReadyAt);
  const swordTick = useGameStore((s) => s.swordTick);
  const swordCastUntil = useGameStore((s) => s.swordCastUntil);
  const swordCastIndex = useGameStore((s) => s.swordCastIndex);
  const techniqueReadyAt = useGameStore((s) => s.techniqueReadyAt);
  const techniqueTick = useGameStore((s) => s.techniqueTick);
  const techniqueCastUntil = useGameStore((s) => s.techniqueCastUntil);
  const instinctReadyAt = useGameStore((s) => s.instinctReadyAt);
  const instinctUntil = useGameStore((s) => s.instinctUntil);
  const instinctDodgeTick = useGameStore((s) => s.instinctDodgeTick);
  const boss = useGameStore((s) => s.boss);
  const invulnerableUntil = useGameStore((s) => s.invulnerableUntil);
  const radar = useGameStore((s) => s.radar);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const flyMode = useGameStore((s) => s.flyMode);
  const noclip = useGameStore((s) => s.noclip);
  const godMode = useGameStore((s) => s.godMode);

  const cls = getPlayerClass(classId);
  const [nowMs, setNowMs] = useState(() => performance.now());
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const timer = window.setInterval(() => setNowMs(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, [phase, paused]);
  const skillRemaining = Math.max(0, (skillReadyAt - nowMs) / 1000);
  const skillReady = skillRemaining <= 0;
  const skillPct = Math.max(0, Math.min(1, 1 - skillRemaining / cls.skill.cooldown));
  const invulnerable = nowMs < invulnerableUntil;

  const weapon = WEAPONS.find((w) => w.id === equipped) ?? WEAPONS[0];
  const maxHp = Math.round(100 + perkHp * 10 + upgrades.maxHpBonus);
  const hpPct = Math.max(0, Math.min(1, hp / maxHp));
  const lowHp = hpPct <= 0.32 && hp > 0;
  const active = phase === 'playing' && !paused;
  const scoped = active && ads && weapon.optic === 'scope';
  const casting = active && nowMs < skillCastUntil;
  const techniqueCasting = active && nowMs < techniqueCastUntil;
  const melee = weapon.kind === 'sword';
  const bladeArts = getSwordCombo(weapon.id);
  const swordCasting =
    active && melee && swordCastIndex >= 0 && nowMs < swordCastUntil
      ? bladeArts[swordCastIndex] ?? null
      : null;
  const techniqueRemaining = Math.max(0, (techniqueReadyAt - nowMs) / 1000);
  const techniqueReady = techniqueRemaining <= 0;
  const techniquePct = Math.max(
    0,
    Math.min(1, 1 - techniqueRemaining / cls.technique.cooldown),
  );
  const instinctRemaining = Math.max(0, (instinctReadyAt - nowMs) / 1000);
  const instinctReady = instinctRemaining <= 0;
  const instinctPct = Math.max(0, Math.min(1, 1 - instinctRemaining / 8.5));
  const ownerActive = flyMode || noclip || godMode;
  const magnification = Math.max(1, 68 / weapon.adsFov);

  const boons: Array<{ label: string; tier: 'mythic' | 'divine'; spent?: boolean }> = [];
  if (upgrades.airJumps > 1) boons.push({ label: `Air jumps ${1 + upgrades.airJumps}`, tier: 'mythic' });
  if (upgrades.chain > 0) boons.push({ label: 'Stormcaller', tier: 'mythic' });
  if (upgrades.refund > 0) boons.push({ label: 'Warden rounds', tier: 'mythic' });
  if (upgrades.regen > 0) boons.push({ label: 'Radiant core', tier: 'divine' });
  if (upgrades.shockwave) boons.push({ label: 'Cataclysm', tier: 'divine' });
  if (upgrades.guardian) {
    boons.push({ label: guardianUsed ? 'Aegis spent' : 'Aegis ready', tier: 'divine', spent: guardianUsed });
  }
  if (invulnerable) boons.push({ label: 'Undying active', tier: 'divine' });

  const engagedCount = radar.blips.filter((b) => b.engaged).length;
  const mapX = (x: number) => ((x + radar.bounds) / (radar.bounds * 2)) * 100;
  const mapZ = (z: number) => ((z + radar.bounds) / (radar.bounds * 2)) * 100;

  const previousHead = useRef(headshotTick);
  const headshot = headshotTick !== previousHead.current;
  useEffect(() => {
    previousHead.current = headshotTick;
  }, [headshotTick]);

  const [banner, setBanner] = useState(true);
  useEffect(() => {
    setBanner(true);
    const timer = window.setTimeout(() => setBanner(false), 2300);
    return () => window.clearTimeout(timer);
  }, [wave]);

  return (
    <div className={`hud ${paused ? 'hud-paused' : ''} ${scoped ? 'hud-scoped' : ''}`}>
      <div className="hud-grain" />
      {lowHp && <div className="low-hp" />}
      {damageTick > 0 && <div key={`dmg-${damageTick}`} className="damage-vignette" />}
      {instinctDodgeTick > 0 && (
        <div key={`dodge-${instinctDodgeTick}`} className="instinct-flash">
          <span>INSTINCT · EVADED</span>
        </div>
      )}
      {guardianTick > 0 && (
        <div key={`aegis-${guardianTick}`} className="aegis-flash">
          <span>Aegis protocol engaged</span>
        </div>
      )}

      <div className="hud-top-left">
        <div className="wave-block">
          <span className="hud-eyebrow">Sector 07 · Containment</span>
          <div className="wave-line">
            <span className="wave-number">{pad(wave)}</span>
            <span className="wave-meta">
              <strong>Wave</strong>
              <em>{enemiesLeft === 0 ? 'Area quiet' : `${enemiesLeft} hostiles`}</em>
            </span>
          </div>
        </div>
        {boons.length > 0 && (
          <div className="buff-strip">
            {boons.map((boon) => (
              <span
                key={boon.label}
                className={`buff-row ${boon.tier} ${boon.spent ? 'spent' : ''}`}
              >
                <i />
                {boon.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="hud-top-right">
        <div className="mode-strip">
          <span className={`mode-chip ${cameraMode === 'third' ? 'active' : ''}`}>
            <b>Caps</b>
            {cameraMode === 'third' ? 'Third person' : 'First person'}
          </span>
          {flyMode && <span className="mode-chip dev">Fly</span>}
          {noclip && <span className="mode-chip dev">Noclip</span>}
          {godMode && <span className="mode-chip dev">God</span>}
          {ownerActive && (
            <div className="owner-strip">
              <span>Owner traversal active</span>
              <em>{flyMode ? 'Space up · C down · Shift boost' : 'Collision bypass engaged'}</em>
            </div>
          )}
        </div>
        <div className="run-stat">
          <span>Run credits</span>
          <strong>{earned}</strong>
        </div>
        <div className="run-stat">
          <span>Eliminations</span>
          <strong>{kills}</strong>
        </div>
      </div>

      <div className="minimap">
        <div className="minimap-head">
          <span className="hud-eyebrow">Enemy scan</span>
          <strong>{radar.blips.length} contacts</strong>
        </div>
        <div className="minimap-frame">
          <div className="minimap-grid" />
          <span className="map-dir d-n">N</span>
          <span className="map-dir d-e">E</span>
          <span className="map-dir d-s">S</span>
          <span className="map-dir d-w">W</span>
          {radar.blips.map((blip) => (
            <span
              key={blip.id}
              className={`map-blip kind-${blip.kind} ${blip.engaged ? 'engaged' : ''}`}
              style={{ left: `${mapX(blip.x)}%`, top: `${mapZ(blip.z)}%` }}
            />
          ))}
          <span
            className="map-player"
            style={{
              left: `${mapX(radar.x)}%`,
              top: `${mapZ(radar.z)}%`,
              transform: `translate(-50%, -50%) rotate(${-radar.yaw}rad)`,
            }}
          >
            <i />
          </span>
        </div>
        <div className="minimap-foot">
          <span><i className="map-dot passive" />Passive</span>
          <span><i className="map-dot engaged" />Engaged {engagedCount}</span>
        </div>
      </div>

      {boss.active && (
        <div className="boss-bar" key={`boss-${boss.wave}`}>
          <div className="boss-bar-head">
            <span className="hud-eyebrow">Containment breach · Wave {boss.wave}</span>
            <strong>{boss.name}</strong>
            <em>
              {Math.max(0, Math.round(boss.hp))} / {boss.maxHp}
            </em>
          </div>
          <div className="boss-track">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100))}%`,
                background: boss.stage > 0 ? '#ff5b3d' : '#ffd479',
              }}
            />
          </div>
          {boss.stage > 0 && <span className="boss-enraged">ENRAGED</span>}
        </div>
      )}
      <div className="kill-feed">
        {feed.map((item) => (
          <div className="feed-row" key={item.id}>
            <span className="feed-weapon">{item.name}</span>
            <span className="feed-line" />
            <span className="feed-victim">{item.victim}</span>
          </div>
        ))}
      </div>

      {banner && (
        <div className="wave-banner" key={`banner-${wave}`}>
          <span className="banner-rule" />
          <div className="banner-copy">
            <span className="hud-eyebrow">Hostiles inbound</span>
            <strong>Wave {pad(wave)}</strong>
            <em>Hold the line</em>
          </div>
          <span className="banner-rule" />
        </div>
      )}

      {casting && (
        <div
          className="cast-banner"
          key={`cast-${skillTick}`}
          style={{ '--cast-color': cls.color } as CSSProperties}
        >
          <span className="cast-rule" />
          <div className="cast-copy">
            <span className="hud-eyebrow">Signature invocation · {cls.code}</span>
            <strong>{cls.skill.name}</strong>
            <em>{cls.name} awakening</em>
          </div>
          <span className="cast-rule" />
          <span className="cast-timer" />
        </div>
      )}

      {techniqueCasting && cls.id === 'ghoul' && (
        <div className="technique-eclipse" key={`eclipse-${techniqueTick}`} />
      )}
      {techniqueCasting && (
        <div className="technique-cast" key={`tech-cast-${techniqueTick}`}>
          <span className="technique-cast-key">E</span>
          <div className="technique-cast-copy">
            <span className="hud-eyebrow">Second technique · {cls.code}</span>
            <strong>{cls.technique.name}</strong>
            <em>{cls.technique.desc}</em>
          </div>
        </div>
      )}
      {swordCasting && (
        <div className="sword-cast" key={`sword-cast-${swordTick}`}>
          <span className="sword-cast-key">{swordCasting.key}</span>
          <div className="sword-cast-copy">
            <span className="hud-eyebrow">Blade art · {weapon.name}</span>
            <strong>{swordCasting.name}</strong>
            <em>{swordCasting.kind === 'nova' ? 'Finisher' : swordCasting.kind === 'wave' ? 'Ranged cut' : 'Blink cut'}</em>
          </div>
        </div>
      )}

      {scoped && (
        <div className="scope-overlay">
          <div className="scope-ring">
            <span className="sr-top" />
            <span className="sr-bottom" />
            <span className="sr-left" />
            <span className="sr-right" />
            <span className="sr-dot" />
            <span className="sr-tick t1" />
            <span className="sr-tick t2" />
            <span className="sr-tick t3" />
          </div>
          <div className="scope-sub">
            <span>{weapon.kind === 'sniper' ? 'Range 800 m' : 'Range 500 m'}</span>
            <span>Wind calm</span>
          </div>
          <div className="scope-data">
            <span>{weapon.name}</span>
            <strong>{magnification.toFixed(1)}×</strong>
            <em>
              {ammo} / {reserve}
            </em>
          </div>
        </div>
      )}

      <div className={`crosshair ${ads ? 'is-ads' : ''} ${reloading ? 'is-reloading' : ''} ${scoped ? 'is-scoped' : ''} ${melee ? 'is-melee' : ''}`}>
        <span className="ch ch-top" />
        <span className="ch ch-bottom" />
        <span className="ch ch-left" />
        <span className="ch ch-right" />
        <span className="ch ch-dot" />
      </div>

      {hitTick > 0 && (
        <div key={`hit-${hitTick}`} className={`hitmarker ${headshot ? 'is-headshot' : ''}`}>
          <span />
          <span />
        </div>
      )}

      {reloading && !melee && (
        <div className="reload-indicator">
          <span>Reloading</span>
          <div className="reload-track">
            <i style={{ animationDuration: `${weapon.reload * upgrades.reload}s` }} />
          </div>
        </div>
      )}

      <div className="ability-stack">
        <div className={`skill-block ${skillReady ? 'is-ready' : ''}`} key={`skill-${skillTick}`}>
          <span className="skill-code" style={{ borderColor: cls.color, color: cls.color }}>
            {cls.code}
          </span>
          <div className="skill-copy">
            <span className="hud-eyebrow">
              {cls.name} · {cls.role}
            </span>
            <strong>{cls.skill.name}</strong>
          </div>
          <div className="skill-key">
            <span>Q</span>
            <em>{skillReady ? 'Ready' : `${skillRemaining.toFixed(1)}s`}</em>
          </div>
          <div className="skill-track">
            <i style={{ width: `${skillPct * 100}%`, background: cls.color }} />
          </div>
        </div>

        <div
          className={`technique-block ${techniqueReady ? 'is-ready' : ''} ${techniqueCasting ? 'is-casting' : ''}`}
          key={`technique-${techniqueTick}`}
        >
          <span className="technique-code" style={{ borderColor: cls.color, color: cls.color }}>
            {cls.code[0]}
            {cls.code[1]}
            {cls.code[2]}
          </span>
          <div className="technique-copy">
            <span className="hud-eyebrow">Second technique · E</span>
            <strong>{cls.technique.name}</strong>
          </div>
          <div className="technique-key">
            <span>E</span>
            <em>{techniqueReady ? 'Ready' : `${techniqueRemaining.toFixed(1)}s`}</em>
          </div>
          <div className="technique-track">
            <i style={{ width: `${techniquePct * 100}%`, background: cls.color }} />
          </div>
        </div>
      </div>

      {melee && (
        <div className="blade-arts" key={`blades-${swordTick}`}>
          <div className="blade-arts-head">
            <span className="hud-eyebrow">Blade arts</span>
            <span className="blade-chain">3-hit chain · cleave</span>
          </div>
          <div className="blade-list">
            {bladeArts.map((art, index) => {
              const remaining = Math.max(0, (swordReadyAt[index] - nowMs) / 1000);
              const ready = remaining <= 0;
              const activeArt =
                swordCastIndex === index && nowMs < swordCastUntil && active;
              return (
                <div
                  key={art.key}
                  className={`blade-row ${ready ? 'is-ready' : ''} ${activeArt ? 'is-casting' : ''}`}
                >
                  <span className="blade-key">{art.key}</span>
                  <div className="blade-copy">
                    <strong>{art.name}</strong>
                    <em>{ready ? 'Ready' : `${remaining.toFixed(1)}s`}</em>
                  </div>
                  <span className="blade-bar">
                    <i
                      style={{
                        width: `${Math.min(100, (1 - remaining / art.cooldown) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`vitals ${lowHp ? 'critical' : ''}`}>
        <div className="vitals-head">
          <span className="hud-eyebrow">Operator integrity</span>
          <strong>
            {Math.round(hp)}
            <em>/{maxHp}</em>
          </strong>
        </div>
        <div className="hp-track">
          <div className="hp-fill" style={{ width: `${hpPct * 100}%` }} />
          <div className="hp-ticks" />
        </div>
        <div className="vitals-foot">
          <div className="medkit-pips">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < medkits ? 'filled' : ''} />
            ))}
          </div>
          <span className="hint-key">H</span>
          <span className="vitals-note">Trauma kit</span>
          <span className="vitals-count">x{medkits}</span>
        </div>
      </div>

      <div className={`instinct-block ${instinctReady ? 'is-ready' : ''} ${nowMs < instinctUntil ? 'is-active' : ''}`}>
        <span className="instinct-code">V</span>
        <div className="instinct-copy">
          <span className="hud-eyebrow">Instinct dodge · V</span>
          <strong>{nowMs < instinctUntil ? 'Evasive' : instinctReady ? 'Ready' : `${instinctRemaining.toFixed(1)}s`}</strong>
        </div>
        <div className="instinct-key">
          <span>V</span>
          <em>{instinctReady ? 'Ready' : `${instinctRemaining.toFixed(1)}s`}</em>
        </div>
        <div className="instinct-track">
          <i style={{ width: `${instinctPct * 100}%` }} />
        </div>
      </div>
      <div className="ammo-block">
        <div className="slots">
          {WEAPONS.map((w, i) => (
            <div
              key={w.id}
              className={`slot ${w.id === equipped ? 'active' : ''} ${owned.includes(w.id) ? 'owned' : ''}`}
            >
              <span className="slot-key">{i + 1}</span>
              <span className="slot-code">{SLOT_CODE[w.id] ?? w.id.slice(0, 3).toUpperCase()}</span>
            </div>
          ))}
        </div>
        <div className="weapon-line">
          <span className="weapon-role">{weapon.role}</span>
          <strong className="weapon-name">{weapon.name}</strong>
        </div>
        {melee ? (
          <div className="ammo-count melee">
            <strong>BLADE</strong>
            <em>{(weapon.reach ?? 3.4).toFixed(1)} m · {1 + weapon.penetration} cleave · 3-hit</em>
          </div>
        ) : (
          <div className="ammo-count">
            <strong className={ammo === 0 ? 'empty' : ''}>{ammo}</strong>
            <span className="ammo-sep">/</span>
            <em>{reserve}</em>
          </div>
        )}
      </div>

      <div className="control-strip">
        <span><b>WASD</b> Move</span>
        <span><b>Space</b> Jump</span>
        <span><b>Shift</b> Sprint</span>
        <span><b>RMB</b> Aim</span>
        {melee ? <span><b>LMB</b> Strike</span> : <span><b>R</b> Reload</span>}
        {melee && <span><b>Z X C</b> Blade arts</span>}
        <span><b>Q</b> Skill</span>
        <span><b>E</b> Technique</span>
        <span><b>V</b> Instinct</span>
        <span><b>Caps</b> Camera</span>
        <span><b>1-0</b> Swap</span>
        <span><b>Esc</b> Pause</span>
      </div>

      {active && ads && !scoped && (
        <div className="ads-tag">{melee ? 'Blade guard' : 'Optics engaged'}</div>
      )}
    </div>
  );
}
