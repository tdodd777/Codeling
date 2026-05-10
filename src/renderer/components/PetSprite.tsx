import { useEffect, useRef, useState } from 'react';
import type { Direction, Species, SpriteManifest } from '@shared/types';

interface Props {
  species: Species;
  stage?: number;                       // evolution stage; defaults to 0
  size?: number;
  animation?: string;                   // defaults to 'idle'
  direction?: Direction;                // defaults to 'south'
  fps?: number;                         // defaults to 6
  equippedCosmetics?: readonly string[]; // cosmeticIds the pet currently has equipped
}

export function PetSprite({
  species,
  stage = 0,
  size = 96,
  animation = 'idle',
  direction = 'south',
  fps = 6,
  equippedCosmetics = [],
}: Props) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    window.codeling.getSprites(species, stage).then(setManifest).catch(console.error);
  }, [species, stage]);

  const frames = manifest?.animations[animation]?.[direction] ?? null;

  useEffect(() => {
    if (!frames || frames.length <= 1) {
      setFrame(0);
      return;
    }
    setFrame(0);
    const interval = Math.max(50, Math.round(1000 / fps));
    timer.current = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, interval);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [frames, fps]);

  const src = frames?.[frame] ?? manifest?.static ?? `./sprites/${species}/south.png`;

  // Resolve overlay URLs for each equipped cosmetic that has art for the
  // current direction (with south as a fallback). When art is missing, the
  // entry is just absent — no broken image, no console noise.
  const overlays: Array<{ id: string; src: string }> = [];
  if (manifest?.cosmeticOverlays) {
    for (const id of equippedCosmetics) {
      const dirs = manifest.cosmeticOverlays[id];
      if (!dirs) continue;
      const url = dirs[direction] ?? dirs.south;
      if (url) overlays.push({ id, src: url });
    }
  }

  return (
    <div className="pet-sprite-stack pet-sprite-idle" style={{ width: size, height: size }}>
      <img
        className="pet-sprite-base"
        src={src}
        alt={species}
        width={size}
        height={size}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      {overlays.map((o) => (
        <img
          key={o.id}
          className="pet-sprite-overlay"
          src={o.src}
          alt=""
          width={size}
          height={size}
          onError={(e) => {
            // Hide silently; manifest scan only adds overlays when the file is
            // present, so this only fires on race-deletion edge cases.
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ))}
    </div>
  );
}
