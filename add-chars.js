const fs = require('fs');
const path = require('path');

const filePath = path.resolve('artifacts/jarvis/src/components/characters/CharacterRenderer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const newCharacters = `
export const NinjaTurtle: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isSleeping = animation === 'sleep';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={animation === 'run' ? 'animate-spin' : 'body overflow-visible'}>
        {isSleeping ? (
          <g transform="translate(0, 30)">
            <path d="M 20 60 Q 50 10 80 60 Z" fill="#27ae60" stroke="#1e8449" strokeWidth="4" />
            <path d="M 25 60 L 75 60 L 65 70 L 35 70 Z" fill="#f1c40f" />
          </g>
        ) : (
          <g>
            <ellipse cx="40" cy="50" rx="20" ry="25" fill="#27ae60" />
            <rect x="35" y="35" width="30" height="40" rx="10" fill="#f1c40f" />
            <rect x="38" y="40" width="24" height="30" rx="5" fill="#f39c12" />
            <g className="limb-l"><rect x="30" y="40" width="8" height="25" rx="4" fill="#2ecc71" /></g>
            <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="62" y="40" width="8" height="25" rx="4" fill="#2ecc71" /></g>
            <g className="limb-l"><rect x="38" y="70" width="8" height="20" rx="4" fill="#2ecc71" /></g>
            <g className="limb-r"><rect x="54" y="70" width="8" height="20" rx="4" fill="#2ecc71" /></g>
            <circle cx="50" cy="25" r="14" fill="#2ecc71" />
            <rect x="35" y="20" width="30" height="8" rx="2" fill="#e74c3c" />
            <path d="M 65 24 Q 75 20 80 26 Q 72 26 65 28 Z" fill="#e74c3c" />
            {(animation === 'happy' || animation === 'excited') ? (
              <g>
                <path d="M 40 25 Q 43 22 46 25" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 25 Q 57 22 60 25" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'sad' ? (
              <g>
                <path d="M 40 23 Q 43 22 46 26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 26 Q 57 22 60 23" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'angry' ? (
              <g>
                <path d="M 40 23 L 46 26" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M 54 26 L 60 23" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <circle cx="43" cy="24" r="2" fill="#fff" />
                <circle cx="57" cy="24" r="2" fill="#fff" />
              </g>
            )}
            <path d="M 46 32 Q 50 35 54 32" fill="none" stroke="#000" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const PirateCaptain: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isWalking = animation === 'walk' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={isWalking ? "translate(0, -5)" : ""}>
          <path d="M 30 40 L 20 80 L 80 80 L 70 40 Z" fill="#8e44ad" />
          <rect x="40" y="40" width="20" height="25" fill="#fff" />
          <line x1="50" y1="40" x2="50" y2="65" stroke="#333" strokeWidth="1" />
          <g className="limb-l"><rect x="42" y="65" width="4" height="25" fill="#8e44ad" /><rect x="43" y="80" width="2" height="15" fill="#d35400" /></g>
          <g className="limb-r"><rect x="54" y="65" width="6" height="20" fill="#34495e" /><rect x="52" y="80" width="10" height="8" rx="2" fill="#000" /></g>
          <g className={animation === 'wave' ? 'arm-wave' : 'limb-l'}>
            <rect x="25" y="40" width="6" height="20" fill="#8e44ad" />
            <path d="M 28 60 Q 20 65 28 70 Q 30 65 25 65" fill="none" stroke="#bdc3c7" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="limb-r"><rect x="69" y="40" width="6" height="25" rx="3" fill="#8e44ad" /><circle cx="72" cy="65" r="3" fill="#f1c40f" /></g>
          <circle cx="50" cy="28" r="14" fill="#f1c40f" />
          <path d="M 25 15 Q 50 -5 75 15 Q 85 25 50 25 Q 15 25 25 15 Z" fill="#2c3e50" />
          <circle cx="44" cy="26" r="3" fill="#000" />
          <line x1="36" y1="20" x2="50" y2="30" stroke="#000" strokeWidth="1" />
          {(animation === 'happy' || animation === 'excited') ? (
            <path d="M 54 26 Q 57 23 60 26" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'sad' ? (
            <path d="M 54 26 Q 57 23 60 27" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'angry' ? (
            <path d="M 54 27 L 60 24" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <g>
              <circle cx="57" cy="26" r="2" fill="#000" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && <line x1="54" y1="27" x2="60" y2="27" stroke="#000" strokeWidth="2" />}
            </g>
          )}
          <path d="M 45 35 L 55 35 L 53 37 Z" fill="#000" />
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const ZombieGuy: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <rect x="35" y="45" width="30" height="35" rx="4" fill="#3498db" />
        <path d="M 35 75 L 40 70 L 45 78 L 50 70 L 60 80 L 65 75" fill="#3498db" />
        <g transform={(animation === 'walk' || animation === 'run') ? "rotate(-45 30 50)" : ""}>
          <rect x="15" y="45" width="25" height="8" rx="4" fill="#1abc9c" />
          <rect x="60" y="45" width="25" height="8" rx="4" fill="#1abc9c" />
        </g>
        <g className={animation === 'walk' || animation === 'run' ? 'limb-r' : 'limb-l'}><rect x="40" y="75" width="6" height="20" fill="#34495e" /></g>
        <g className={animation === 'walk' || animation === 'run' ? '' : 'limb-r'}><rect x="54" y="75" width="6" height="15" fill="#34495e" transform={animation === 'walk' || animation === 'run' ? "rotate(-15 54 75)" : ""} /></g>
        <circle cx="50" cy="30" r="15" fill="#1abc9c" />
        <path d="M 45 15 Q 50 10 55 15 Q 60 20 55 20 Q 50 22 45 20 Z" fill="#e74c3c" />
        {(animation === 'happy' || animation === 'excited') ? (
          <g>
            <path d="M 40 28 Q 43 25 46 28" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 28 Q 57 25 60 28" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'sad' ? (
          <g>
            <path d="M 40 26 Q 43 25 46 30" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 30 Q 57 25 60 26" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : animation === 'angry' ? (
          <g>
            <path d="M 40 26 L 46 30" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
            <path d="M 54 30 L 60 26" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="43" cy="28" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="43" cy="28" r="1" fill="#e74c3c" className={animation === 'sleep' ? 'opacity-0' : ''} />
            <circle cx="57" cy="30" r="2" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && (
              <g>
                <line x1="40" y1="30" x2="46" y2="30" stroke="#2c3e50" strokeWidth="2" />
                <line x1="54" y1="30" x2="60" y2="30" stroke="#2c3e50" strokeWidth="2" />
              </g>
            )}
          </g>
        )}
        <path d="M 45 38 L 47 40 L 49 38 L 51 40 L 53 38 L 55 40" fill="none" stroke="#2c3e50" strokeWidth="1.5" />
      </svg>
    </BaseCharacter>
  );
};

export const CyberBot: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g className={animation === 'walk' || animation === 'run' ? 'limb-l' : ''}>
          <rect x="25" y="70" width="50" height="20" rx="10" fill="#7f8c8d" />
          <circle cx="35" cy="80" r="6" fill="#bdc3c7" />
          <circle cx="50" cy="80" r="6" fill="#bdc3c7" />
          <circle cx="65" cy="80" r="6" fill="#bdc3c7" />
          <path d="M 25 80 L 75 80" stroke="#34495e" strokeWidth="2" strokeDasharray="4 4" />
        </g>
        <path d="M 35 45 L 65 45 L 70 70 L 30 70 Z" fill="#2c3e50" />
        <rect x="40" y="50" width="20" height="15" fill="#e74c3c" className={animation === 'excited' ? 'animate-pulse' : ''} />
        <g className="limb-l"><rect x="20" y="45" width="8" height="20" rx="2" fill="#bdc3c7" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="72" y="45" width="8" height="20" rx="2" fill="#bdc3c7" /></g>
        <rect x="35" y="15" width="30" height="25" rx="5" fill="#bdc3c7" />
        <line x1="50" y1="15" x2="50" y2="5" stroke="#7f8c8d" strokeWidth="2" />
        <circle cx="50" cy="5" r="3" fill="#e74c3c" className="animate-pulse" />
        <rect x="38" y="22" width="24" height="10" rx="2" fill="#000" />
        {(animation === 'happy' || animation === 'excited') ? (
          <path d="M 40 27 Q 50 20 60 27" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : animation === 'sad' ? (
          <path d="M 40 25 Q 50 30 60 25" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : animation === 'angry' ? (
          <path d="M 40 24 L 50 28 L 60 24" fill="none" stroke="#e74c3c" strokeWidth="3" />
        ) : (
          <g>
            <rect x="42" y="24" width="16" height="6" rx="3" fill="#e74c3c" className={animation === 'sleep' ? 'opacity-0' : ''} />
            {animation === 'sleep' && <line x1="42" y1="27" x2="58" y2="27" stroke="#e74c3c" strokeWidth="2" />}
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const VampireLord: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isBat = animation === 'run' || animation === 'dance';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        {isBat ? (
          <g transform="translate(0, 30)">
            <ellipse cx="50" cy="40" rx="15" ry="10" fill="#000" />
            <path d="M 35 40 Q 20 20 10 30 Q 25 45 35 40 Z" fill="#000" className="limb-l" />
            <path d="M 65 40 Q 80 20 90 30 Q 75 45 65 40 Z" fill="#000" className="limb-r" />
            <polygon points="45,35 48,25 50,30" fill="#000" />
            <polygon points="55,35 52,25 50,30" fill="#000" />
            <circle cx="45" cy="38" r="2" fill="#e74c3c" />
            <circle cx="55" cy="38" r="2" fill="#e74c3c" />
          </g>
        ) : (
          <g>
            <path d="M 30 30 L 10 90 L 90 90 L 70 30 Z" fill="#000" />
            <path d="M 35 30 L 20 85 L 80 85 L 65 30 Z" fill="#e74c3c" />
            <rect x="40" y="45" width="20" height="35" fill="#2c3e50" />
            <g className="limb-l"><rect x="35" y="45" width="6" height="25" fill="#2c3e50" /></g>
            <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="59" y="45" width="6" height="25" fill="#2c3e50" /></g>
            <g className="limb-l"><rect x="42" y="80" width="6" height="15" fill="#000" /></g>
            <g className="limb-r"><rect x="52" y="80" width="6" height="15" fill="#000" /></g>
            <circle cx="50" cy="30" r="14" fill="#ecf0f1" />
            <path d="M 36 30 Q 36 10 50 15 Q 64 10 64 30 L 60 20 Q 50 25 40 20 Z" fill="#000" />
            {(animation === 'happy' || animation === 'excited') ? (
              <g>
                <path d="M 42 28 Q 45 25 48 28" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 28 Q 55 25 58 28" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'sad' ? (
              <g>
                <path d="M 42 26 Q 45 25 48 30" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 30 Q 55 25 58 26" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : animation === 'angry' ? (
              <g>
                <path d="M 42 26 L 48 30" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M 52 30 L 58 26" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <circle cx="45" cy="28" r="2" fill="#c0392b" className={animation === 'sleep' ? 'opacity-0' : ''} />
                <circle cx="55" cy="28" r="2" fill="#c0392b" className={animation === 'sleep' ? 'opacity-0' : ''} />
                {animation === 'sleep' && (
                  <g>
                    <line x1="42" y1="28" x2="48" y2="28" stroke="#000" strokeWidth="2" />
                    <line x1="52" y1="28" x2="58" y2="28" stroke="#000" strokeWidth="2" />
                  </g>
                )}
              </g>
            )}
            <path d="M 46 35 Q 50 38 54 35" fill="none" stroke="#000" strokeWidth="1" />
            <polygon points="46,35 48,35 47,38" fill="#fff" />
            <polygon points="52,35 54,35 53,38" fill="#fff" />
          </g>
        )}
      </svg>
    </BaseCharacter>
  );
};

export const GhostBoo: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isAngry = animation === 'angry' || animation === 'excited';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={animation === 'walk' || animation === 'run' ? 'translate(0, -5)' : ''} className="arm-wave">
          <path d={\`M 30 40 Q 50 10 70 40 L 70 80 \${isAngry ? 'Q 65 90 60 80 Q 55 70 50 80 Q 45 90 40 80 Q 35 70 30 80' : 'Q 60 70 50 80 Q 40 90 30 80'} Z\`} fill="#ecf0f1" opacity={isAngry ? "1" : "0.85"} />
          <path d="M 30 50 Q 20 40 15 50" fill="none" stroke="#ecf0f1" strokeWidth="6" strokeLinecap="round" className="limb-l" />
          <path d="M 70 50 Q 80 40 85 50" fill="none" stroke="#ecf0f1" strokeWidth="6" strokeLinecap="round" className={animation === 'wave' ? 'arm-wave' : 'limb-r'} />
          {(animation === 'happy' || animation === 'excited') ? (
            <g>
              <path d="M 40 33 Q 43 30 46 33" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 33 Q 57 30 60 33" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : animation === 'sad' ? (
            <g>
              <path d="M 40 31 Q 43 30 46 35" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 35 Q 57 30 60 31" fill="none" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : animation === 'angry' ? (
            <g>
              <path d="M 40 31 L 46 35" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
              <path d="M 54 35 L 60 31" stroke="#2c3e50" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx="43" cy="35" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
              <circle cx="57" cy="35" r="4" fill="#2c3e50" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && (
                <g>
                  <line x1="40" y1="35" x2="46" y2="35" stroke="#2c3e50" strokeWidth="3" />
                  <line x1="54" y1="35" x2="60" y2="35" stroke="#2c3e50" strokeWidth="3" />
                </g>
              )}
            </g>
          )}
          {animation === 'talk' || animation === 'excited' ? (
            <ellipse cx="50" cy="48" rx="4" ry="6" fill="#2c3e50" />
          ) : animation === 'happy' ? (
            <path d="M 46 45 Q 50 50 54 45" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          ) : animation === 'sad' ? (
            <path d="M 46 48 Q 50 44 54 48" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <ellipse cx="50" cy="45" rx="3" ry="4" fill="#2c3e50" />
          )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const SamuraiWarrior: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const isKneeling = animation === 'sleep';
  const drawSword = animation === 'excited' || animation === 'angry' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="body overflow-visible">
        <g transform={isKneeling ? "translate(0, 15)" : ""}>
          {!drawSword && <line x1="20" y1="30" x2="80" y2="90" stroke="#7f8c8d" strokeWidth="4" />}
          <rect x="35" y="45" width="30" height="30" fill="#c0392b" />
          <line x1="35" y1="55" x2="65" y2="55" stroke="#922b21" strokeWidth="2" />
          <line x1="35" y1="65" x2="65" y2="65" stroke="#922b21" strokeWidth="2" />
          <g className={isKneeling ? "" : "limb-l"}><rect x="38" y="75" width="8" height={isKneeling ? "15" : "20"} fill="#34495e" transform={isKneeling ? "rotate(45 38 75)" : ""} /></g>
          <g className={isKneeling ? "" : "limb-r"}><rect x="54" y="75" width="8" height={isKneeling ? "15" : "20"} fill="#34495e" transform={isKneeling ? "rotate(-45 54 75)" : ""} /></g>
          <g className="limb-l"><rect x="25" y="45" width="8" height="25" rx="4" fill="#c0392b" /></g>
          <g className={animation === 'wave' ? 'arm-wave' : drawSword ? '' : 'limb-r'}>
            <rect x="67" y="45" width="8" height="25" rx="4" fill="#c0392b" transform={drawSword ? "rotate(-45 67 45)" : ""} />
            {drawSword && <line x1="71" y1="70" x2="90" y2="20" stroke="#bdc3c7" strokeWidth="4" />}
          </g>
          <circle cx="50" cy="30" r="14" fill="#f1c40f" />
          <path d="M 30 30 Q 50 10 70 30 L 65 35 L 35 35 Z" fill="#34495e" />
          <path d="M 45 15 L 40 5 L 48 10 Z" fill="#f1c40f" />
          <path d="M 55 15 L 60 5 L 52 10 Z" fill="#f1c40f" />
          <rect x="40" y="24" width="20" height="6" fill="#000" />
          {(animation === 'happy' || animation === 'excited') ? (
            <g>
              <path d="M 42 27 Q 45 25 48 27" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 27 Q 55 25 58 27" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : animation === 'sad' ? (
            <g>
              <path d="M 42 25 Q 45 25 48 28" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 28 Q 55 25 58 25" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : animation === 'angry' ? (
            <g>
              <path d="M 42 25 L 48 28" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
              <path d="M 52 28 L 58 25" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx="45" cy="27" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
              <circle cx="55" cy="27" r="1" fill="#fff" className={animation === 'sleep' ? 'opacity-0' : ''} />
              {animation === 'sleep' && (
                <g>
                  <line x1="42" y1="27" x2="48" y2="27" stroke="#fff" strokeWidth="1" />
                  <line x1="52" y1="27" x2="58" y2="27" stroke="#fff" strokeWidth="1" />
                </g>
              )}
            </g>
          )}
        </g>
      </svg>
    </BaseCharacter>
  );
};

export const Astronaut: React.FC<CharacterProps> = ({ animation = 'idle', size = 80, flipped = false }) => {
  const zeroG = animation === 'walk' || animation === 'run';
  return (
    <BaseCharacter size={size} flipped={flipped} animation={animation}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" className={zeroG ? "arm-wave overflow-visible" : "body overflow-visible"}>
        <rect x="25" y="40" width="50" height="40" rx="5" fill="#bdc3c7" />
        <rect x="35" y="45" width="30" height="35" rx="10" fill="#fff" stroke="#ecf0f1" strokeWidth="2" />
        <g className="limb-l"><rect x="30" y="45" width="10" height="25" rx="5" fill="#fff" /></g>
        <g className={animation === 'wave' ? 'arm-wave' : 'limb-r'}><rect x="60" y="45" width="10" height="25" rx="5" fill="#fff" /></g>
        <g className="limb-l"><rect x="38" y="75" width="10" height="20" rx="5" fill="#fff" /></g>
        <g className="limb-r"><rect x="52" y="75" width="10" height="20" rx="5" fill="#fff" /></g>
        <circle cx="50" cy="30" r="18" fill="#fff" />
        <ellipse cx="50" cy="32" rx="12" ry="10" fill="#e67e22" opacity="0.8" />
        <ellipse cx="46" cy="28" rx="4" ry="3" fill="#fff" opacity="0.5" />
        {(animation === 'happy' || animation === 'excited') ? (
          <path d="M 45 35 Q 50 38 55 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : animation === 'sad' ? (
          <path d="M 45 36 Q 50 33 55 36" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : animation === 'angry' ? (
          <path d="M 45 35 L 55 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        ) : (
          <path d="M 47 35 Q 50 36 53 35" fill="none" stroke="#fff" strokeWidth="1.5" />
        )}
      </svg>
    </BaseCharacter>
  );
};
\`;

const marker = "export const charactersMap: Record<string, React.FC<CharacterProps>> = {";
content = content.replace(marker, newCharacters + '\\n' + marker);

content = content.replace(marker, 
\`export const charactersMap: Record<string, React.FC<CharacterProps>> = {
  'ninja-turtle': NinjaTurtle,
  'pirate-captain': PirateCaptain,
  'zombie-guy': ZombieGuy,
  'cyber-bot': CyberBot,
  'vampire-lord': VampireLord,
  'ghost-boo': GhostBoo,
  'samurai-warrior': SamuraiWarrior,
  'astronaut': Astronaut,\`);

fs.writeFileSync(filePath, content);
console.log('Successfully added characters to CharacterRenderer.tsx');
