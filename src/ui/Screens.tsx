import { useEffect, type CSSProperties } from 'react';
import { getPlayerClass, PLAYER_CLASSES } from '../data/classes';
import { COATS } from '../data/cosmetics';
import { getSwordCombo } from '../data/swordSkills';
import { UPGRADE_RARITY_LABEL } from '../data/upgrades';
import { rarityLabel, WEAPONS } from '../data/weapons';
import { sfx } from '../game/audio';
import { useGameStore, type Perks } from '../store/useGameStore';
import { lockPointer } from './pointer';

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

interface TitleProps {
  onDeploy: () => void;
  onArmory: () => void;
}

export function TitleScreen({ onDeploy, onArmory }: TitleProps) {
  const bank = useGameStore((s) => s.bank);
  const bestWave = useGameStore((s) => s.bestWave);
  const equipped = useGameStore((s) => s.equipped);
  const owned = useGameStore((s) => s.owned);
  const classId = useGameStore((s) => s.classId);
  const ownedClasses = useGameStore((s) => s.ownedClasses);
  const weapon = WEAPONS.find((w) => w.id === equipped) ?? WEAPONS[0];
  const activeClass = getPlayerClass(classId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onDeploy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDeploy]);

  return (
    <div className="screen title-screen">
      <div className="title-grid" />
      <div className="title-inner">
        <div className="brand-block">
          <span className="kicker">Forward operating base · Sector 07</span>
          <h1 className="game-title">
            <span>Hold</span>
            <span className="outline">The Line</span>
          </h1>
          <p className="lede">
            A perimeter under siege. Limited ammunition, escalating pressure, and one operator
            between the breach and the last line of defence.
          </p>
          <div className="title-tags">
            <span>Wave survival</span>
            <span>Ballistic combat</span>
            <span>Persistent armory</span>
            <span>Mythic requisitions</span>
          </div>
        </div>

        <aside className="title-panel">
          <div className="panel-head">
            <span className="hud-eyebrow">Operation dossier</span>
            <span className="panel-code">HTL-07</span>
          </div>
          <div className="panel-row">
            <span>Active loadout</span>
            <strong>{weapon.name}</strong>
          </div>
          <div className="panel-row">
            <span>Owned platforms</span>
            <strong>{owned.length} / {WEAPONS.length}</strong>
          </div>
          <div className="panel-row">
            <span>Active class</span>
            <strong style={{ color: activeClass.color }}>{activeClass.name}</strong>
          </div>
          <div className="panel-row">
            <span>Classes unlocked</span>
            <strong>{ownedClasses.length} / {PLAYER_CLASSES.length}</strong>
          </div>
          <div className="panel-row">
            <span>Reserve bank</span>
            <strong>{bank.toLocaleString()} CR</strong>
          </div>
          <div className="panel-row">
            <span>Best run</span>
            <strong>{bestWave > 0 ? `Wave ${bestWave}` : 'No record'}</strong>
          </div>

          <div className="panel-actions">
            <button className="btn btn-primary" onClick={onDeploy}>
              Deploy
              <span className="btn-key">Enter</span>
            </button>
            <button className="btn" onClick={onArmory}>
              Armory
            </button>
          </div>

          <div className="panel-foot">
            <span>Weapon of record</span>
            <strong>{weapon.role}</strong>
          </div>
        </aside>
      </div>

      <div className="title-classes">
        <div className="title-classes-head">
          <span className="hud-eyebrow">Operator classes</span>
          <span>{activeClass.skill.name} — press Q in the field</span>
        </div>
        <div className="title-class-row">
          {PLAYER_CLASSES.map((entry) => {
            const active = entry.id === classId;
            const unlocked = ownedClasses.includes(entry.id);
            return (
              <div
                key={entry.id}
                className={`title-class ${active ? 'is-active' : ''} ${unlocked ? 'is-owned' : ''}`}
                style={active ? { borderColor: entry.color } : undefined}
              >
                <span className="title-class-code" style={{ color: entry.color }}>
                  {entry.code}
                </span>
                <span className="title-class-name">{entry.name}</span>
                <span className="title-class-state">{active ? 'Active' : unlocked ? 'Owned' : 'Locked'}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="title-footer">
        <span><b>WASD</b> Move</span>
        <span><b>Space</b> Jump</span>
        <span><b>LMB</b> Fire</span>
        <span><b>RMB</b> Aim</span>
        <span><b>R</b> Reload</span>
        <span><b>Q</b> Class skill</span>
        <span><b>H</b> Trauma kit</span>
        <span><b>Esc</b> Pause</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upgrade                                                             */
/* ------------------------------------------------------------------ */

const RARITY_LABEL = UPGRADE_RARITY_LABEL;

export function UpgradeScreen() {
  const choices = useGameStore((s) => s.choices);
  const wave = useGameStore((s) => s.wave);
  const taken = useGameStore((s) => s.taken);
  const takeUpgrade = useGameStore((s) => s.takeUpgrade);
  const nextWave = useGameStore((s) => s.nextWave);

  const choose = (id: string) => {
    const card = choices.find((c) => c.id === id);
    if (card) sfx.select(card.rarity);
    takeUpgrade(id);
    lockPointer();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < choices.length) {
        sfx.select(choices[index].rarity);
        takeUpgrade(choices[index].id);
        lockPointer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, takeUpgrade]);

  const payout = 45 + wave * 15;

  return (
    <div className="screen upgrade-screen">
      <div className="upgrade-head">
        <span className="kicker danger">Wave {String(wave).padStart(2, '0')} cleared</span>
        <h2>Field requisition</h2>
        <p>
          Select one modification before the next assault. Requisitions stack for the remainder of
          this run. Mythic and divine cards become more likely as the sector escalates, and every
          fifth wave guarantees one.
        </p>
        <div className="upgrade-payout">
          <span>Credits secured</span>
          <strong>+{payout} CR</strong>
        </div>
      </div>

      {choices.length > 0 ? (
        <div className="upgrade-grid">
          {choices.map((card, index) => (
            <button
              key={card.id}
              className={`upgrade-card rarity-${card.rarity}`}
              onClick={() => choose(card.id)}
            >
              <span className="upgrade-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="upgrade-rarity">{RARITY_LABEL[card.rarity]}</span>
              <h3>{card.name}</h3>
              <p>{card.desc}</p>
              <span className="upgrade-select">
                Select modification
                <b>[{index + 1}]</b>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => {
            nextWave();
            lockPointer();
          }}
        >
          Continue to next wave
        </button>
      )}

      <div className="upgrade-foot">
        <span>Modifications taken: {taken.length}</span>
        <span>Higher tiers restore more integrity</span>
        <span>Mythic or divine guaranteed every fifth wave</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Armory                                                              */
/* ------------------------------------------------------------------ */

interface PerkDef {
  key: keyof Perks;
  name: string;
  desc: string;
  base: number;
}

const PERKS: PerkDef[] = [
  { key: 'hp', name: 'Vitality', desc: '+10 maximum integrity per rank.', base: 300 },
  { key: 'speed', name: 'Mobility', desc: '+2% movement speed per rank.', base: 250 },
  { key: 'damage', name: 'Ballistics', desc: '+4% weapon damage per rank.', base: 350 },
  { key: 'armor', name: 'Plating', desc: '+3% incoming damage reduction per rank.', base: 350 },
];

const PERK_MAX = 5;

interface ArmoryProps {
  onBack: () => void;
}

export function ArmoryScreen({ onBack }: ArmoryProps) {
  const bank = useGameStore((s) => s.bank);
  const owned = useGameStore((s) => s.owned);
  const equipped = useGameStore((s) => s.equipped);
  const perks = useGameStore((s) => s.perks);
  const medkits = useGameStore((s) => s.medkits);
  const bestWave = useGameStore((s) => s.bestWave);
  const ownedClasses = useGameStore((s) => s.ownedClasses);
  const classId = useGameStore((s) => s.classId);
  const ownedCoats = useGameStore((s) => s.ownedCoats);
  const coatId = useGameStore((s) => s.coatId);
  const buyWeapon = useGameStore((s) => s.buyWeapon);
  const equipWeapon = useGameStore((s) => s.equipWeapon);
  const buyClass = useGameStore((s) => s.buyClass);
  const equipClass = useGameStore((s) => s.equipClass);
  const buyCoat = useGameStore((s) => s.buyCoat);
  const equipCoat = useGameStore((s) => s.equipCoat);
  const buyPerk = useGameStore((s) => s.buyPerk);
  const buyMedkit = useGameStore((s) => s.buyMedkit);

  return (
    <div className="screen armory-screen">
      <header className="armory-head">
        <div>
          <span className="kicker">Persistent inventory</span>
          <h2>Armory</h2>
        </div>
        <div className="armory-head-right">
          <div className="bank-readout">
            <span>Reserve bank</span>
            <strong>{bank.toLocaleString()} CR</strong>
          </div>
          <button className="btn btn-ghost" onClick={onBack}>
            Return
          </button>
        </div>
      </header>

      <div className="armory-body">
        <section className="rack">
          <div className="section-head">
            <h3>Weapon rack</h3>
            <span>{owned.length} of {WEAPONS.length} platforms owned</span>
          </div>
          <div className="weapon-grid">
            {WEAPONS.map((weapon) => {
              const isOwned = owned.includes(weapon.id);
              const isEquipped = equipped === weapon.id;
              const affordable = bank >= weapon.price;
              return (
                <article
                  key={weapon.id}
                  className={`weapon-card rarity-${weapon.rarity} ${isOwned ? 'owned' : ''} ${
                    isEquipped ? 'equipped' : ''
                  }`}
                >
                  <div className="weapon-card-top">
                    <span className="weapon-rarity">{rarityLabel[weapon.rarity]}</span>
                    {isEquipped && <span className="equipped-tag">Equipped</span>}
                  </div>
                  <h4>{weapon.name}</h4>
                  <span className="weapon-role">{weapon.role}</span>
                  <p className="weapon-desc">{weapon.desc}</p>
                  <div className="weapon-stats">
                    {weapon.kind === 'sword' ? (
                      <>
                        <div>
                          <span>Damage</span>
                          <strong>{weapon.damage}</strong>
                        </div>
                        <div>
                          <span>Reach</span>
                          <strong>{(weapon.reach ?? 3.4).toFixed(1)} m</strong>
                        </div>
                        <div>
                          <span>Cleave</span>
                          <strong>{1 + weapon.penetration}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span>Damage</span>
                          <strong>{weapon.damage}{weapon.pellets > 1 ? ` x${weapon.pellets}` : ''}</strong>
                        </div>
                        <div>
                          <span>Cycle</span>
                          <strong>{weapon.rpm} rpm</strong>
                        </div>
                        <div>
                          <span>Magazine</span>
                          <strong>{weapon.mag}</strong>
                        </div>
                      </>
                    )}
                  </div>
                  {weapon.kind === 'sword' && (
                    <div className="weapon-combos">
                      {getSwordCombo(weapon.id).map((art) => (
                        <span key={art.key} className="weapon-combo">
                          <b>{art.key}</b>
                          {art.name}
                          <em>{art.cooldown}s</em>
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    className={`card-action ${isEquipped ? 'is-active' : ''}`}
                    disabled={isEquipped || (!isOwned && !affordable)}
                    onClick={() => {
                      if (isOwned) equipWeapon(weapon.id);
                      else buyWeapon(weapon.id);
                    }}
                  >
                    {isEquipped
                      ? 'Equipped'
                      : isOwned
                        ? 'Equip platform'
                        : affordable
                          ? `Purchase · ${weapon.price.toLocaleString()} CR`
                          : `Locked · ${weapon.price.toLocaleString()} CR`}
                  </button>
                </article>
              );
            })}
          </div>

          <section className="class-rack">
          <div className="section-head">
            <h3>Operator classes</h3>
            <span>{ownedClasses.length} of {PLAYER_CLASSES.length} unlocked · one signature skill each</span>
          </div>
          <div className="class-grid">
            {PLAYER_CLASSES.map((entry) => {
              const isOwned = ownedClasses.includes(entry.id);
              const isEquipped = classId === entry.id;
              const affordable = bank >= entry.price;
              return (
                <article
                  key={entry.id}
                  className={`class-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}
                  style={{ '--class-color': entry.color } as CSSProperties}
                >
                  <div className="class-card-top">
                    <span className="class-code">{entry.code}</span>
                    <span className="class-role">{entry.role}</span>
                    {isEquipped && <span className="equipped-tag">Active</span>}
                  </div>
                  <h4>{entry.name}</h4>
                  <p className="class-desc">{entry.desc}</p>
                  <div className="class-benefit">
                    <span>Passive</span>
                    <p>{entry.passive}</p>
                  </div>
                  <div className="class-skill">
                    <div>
                      <span>Q skill</span>
                      <strong>{entry.skill.name}</strong>
                    </div>
                    <b>{entry.skill.cooldown}s</b>
                    <p>{entry.skill.desc}</p>
                  </div>
                  <button
                    className={`card-action ${isEquipped ? 'is-active' : ''}`}
                    disabled={isEquipped || (!isOwned && !affordable)}
                    onClick={() => {
                      if (isOwned) equipClass(entry.id);
                      else buyClass(entry.id);
                    }}
                  >
                    {isEquipped
                      ? 'Active class'
                      : isOwned
                        ? 'Deploy as class'
                        : affordable
                          ? `Recruit · ${entry.price.toLocaleString()} CR`
                          : `Locked · ${entry.price.toLocaleString()} CR`}
                  </button>
                </article>
              );
            })}
          </div>
          </section>

          <section className="class-rack coat-rack">
            <div className="section-head">
              <h3>Coat locker</h3>
              <span>{ownedCoats.length} of {COATS.length} patterns · tailored silhouette</span>
            </div>
            <div className="coat-grid">
              {COATS.map((coat) => {
                const isOwned = ownedCoats.includes(coat.id);
                const isEquipped = coatId === coat.id;
                const affordable = bank >= coat.price;
                const color = `#${coat.color.toString(16).padStart(6, '0')}`;
                const lining = `#${coat.lining.toString(16).padStart(6, '0')}`;
                const accent = `#${coat.accent.toString(16).padStart(6, '0')}`;
                return (
                  <article
                    key={coat.id}
                    className={`coat-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`}
                    style={
                      {
                        '--coat-color': color,
                        '--coat-lining': lining,
                        '--coat-accent': accent,
                      } as CSSProperties
                    }
                  >
                    <div className="coat-swatch">
                      <span className="coat-figure" />
                      <span className="coat-shoulders" />
                      <span className="coat-buckle" />
                      <span className="coat-hem" />
                    </div>
                    <div className="coat-copy">
                      <span className="coat-role">{coat.role}</span>
                      <h4>{coat.name}</h4>
                      <p>{coat.desc}</p>
                      <span className="coat-palette" aria-hidden>
                        <i style={{ background: color }} />
                        <i style={{ background: lining }} />
                        <i style={{ background: accent }} />
                      </span>
                    </div>
                    <button
                      className={`card-action coat-action ${isEquipped ? 'is-active' : ''}`}
                      disabled={isEquipped || (!isOwned && !affordable)}
                      onClick={() => {
                        if (isOwned) equipCoat(coat.id);
                        else buyCoat(coat.id);
                      }}
                    >
                      {isEquipped
                        ? 'Worn'
                        : isOwned
                          ? 'Wear coat'
                          : affordable
                            ? `Unlock · ${coat.price.toLocaleString()} CR`
                            : `Locked · ${coat.price.toLocaleString()} CR`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="barracks">
          <div className="section-head">
            <h3>Operator upgrades</h3>
            <span>Ranks persist across runs</span>
          </div>

          <div className="perk-list">
            {PERKS.map((perk) => {
              const level = perks[perk.key];
              const maxed = level >= PERK_MAX;
              const cost = perk.base * (level + 1);
              return (
                <div className="perk-row" key={perk.key}>
                  <div className="perk-copy">
                    <div className="perk-title">
                      <strong>{perk.name}</strong>
                      <span className="perk-level">
                        {level} / {PERK_MAX}
                      </span>
                    </div>
                    <p>{perk.desc}</p>
                    <div className="perk-pips">
                      {Array.from({ length: PERK_MAX }).map((_, i) => (
                        <span key={i} className={i < level ? 'filled' : ''} />
                      ))}
                    </div>
                  </div>
                  <button
                    className="perk-buy"
                    disabled={maxed || bank < cost}
                    onClick={() => buyPerk(perk.key, cost)}
                  >
                    {maxed ? 'Maxed' : `${cost} CR`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="section-head supplies-head">
            <h3>Field supplies</h3>
            <span>Loaded on deployment</span>
          </div>
          <div className="supply-row">
            <div>
              <strong>Trauma kit</strong>
              <p>Restores 45 integrity in the field. Press H to use. Maximum of three.</p>
              <div className="supply-pips">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < medkits ? 'filled' : ''} />
                ))}
              </div>
            </div>
            <button
              className="perk-buy"
              disabled={medkits >= 3 || bank < 120}
              onClick={buyMedkit}
            >
              {medkits >= 3 ? 'Full' : '120 CR'}
            </button>
          </div>

          <div className="barracks-record">
            <span>Best run</span>
            <strong>{bestWave > 0 ? `Wave ${bestWave}` : 'No record'}</strong>
          </div>
          <p className="barracks-note">Progress is saved locally. Banked credits carry into the next operation.</p>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game over                                                           */
/* ------------------------------------------------------------------ */

interface GameOverProps {
  onRedeploy: () => void;
}

export function GameOverScreen({ onRedeploy }: GameOverProps) {
  const wave = useGameStore((s) => s.wave);
  const kills = useGameStore((s) => s.kills);
  const earned = useGameStore((s) => s.earned);
  const bestWave = useGameStore((s) => s.bestWave);
  const bank = useGameStore((s) => s.bank);
  const abandonRun = useGameStore((s) => s.abandonRun);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onRedeploy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRedeploy]);

  return (
    <div className="screen gameover-screen">
      <div className="gameover-inner">
        <span className="kicker danger">Signal lost · Sector overrun</span>
        <h2 className="gameover-title">
          <span>Line</span>
          <span className="outline">Broken</span>
        </h2>
        <p className="gameover-copy">
          The perimeter collapsed on wave {wave}. Requisition records were recovered and your
          credits have been banked.
        </p>

        <div className="gameover-stats">
          <div>
            <span>Waves held</span>
            <strong>{wave}</strong>
          </div>
          <div>
            <span>Eliminations</span>
            <strong>{kills}</strong>
          </div>
          <div>
            <span>Credits earned</span>
            <strong>{earned}</strong>
          </div>
          <div>
            <span>Best run</span>
            <strong>{bestWave}</strong>
          </div>
        </div>

        <div className="gameover-actions">
          <button className="btn btn-primary" onClick={onRedeploy}>
            Redeploy
            <span className="btn-key">Enter</span>
          </button>
          <button className="btn" onClick={abandonRun}>
            Return to base
          </button>
        </div>

        <div className="gameover-foot">
          <span>Bank balance</span>
          <strong>{bank.toLocaleString()} CR</strong>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */

interface PauseProps {
  onResume: () => void;
}

export function PauseScreen({ onResume }: PauseProps) {
  const wave = useGameStore((s) => s.wave);
  const kills = useGameStore((s) => s.kills);
  const earned = useGameStore((s) => s.earned);
  const medkits = useGameStore((s) => s.medkits);
  const abandonRun = useGameStore((s) => s.abandonRun);

  return (
    <div className="screen pause-screen">
      <div className="pause-box">
        <span className="kicker">Operation suspended</span>
        <h2>Paused</h2>
        <p>The field is frozen while the pointer is released. Resume to re-engage the assault.</p>
        <div className="pause-stats">
          <div>
            <span>Wave</span>
            <strong>{wave}</strong>
          </div>
          <div>
            <span>Eliminations</span>
            <strong>{kills}</strong>
          </div>
          <div>
            <span>Credits</span>
            <strong>{earned}</strong>
          </div>
          <div>
            <span>Trauma kits</span>
            <strong>{medkits}</strong>
          </div>
        </div>
        <div className="pause-actions">
          <button className="btn btn-primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn btn-ghost" onClick={abandonRun}>
            Abandon run
          </button>
        </div>
        <span className="pause-note">Banked credits are kept when a run is abandoned.</span>
      </div>
    </div>
  );
}
