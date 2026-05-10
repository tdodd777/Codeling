import { useEffect, useRef, useState } from 'react';
import type { Direction, Species, SpriteManifest } from '@shared/types';

interface Props {
  species: Species;
  size?: number;
  animation?: string;       // defaults to 'idle'
  direction?: Direction;    // defaults to 'south'
  fps?: number;             // defaults to 6
}

export function PetSprite({
  species,
  size = 96,
  animation = 'idle',
  direction = 'south',
  fps = 6,
}: Props) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    window.codeling.getSprites(species).then(setManifest).catch(console.error);
  }, [species]);

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

  return (
    <img
      className="pet-sprite-idle"
      src={src}
      alt={species}
      width={size}
      height={size}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}
