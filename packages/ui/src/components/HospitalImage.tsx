import Image from 'next/image';
import { monogram, sceneDataUri, sceneFor } from '../placeholder-art';
import { cn } from '../lib/cn';

export interface HospitalImageProps {
  /** Slot id from the media plan (e.g. "patients-hero", "dept-chirurgia", "doc-kulan"). */
  slot: string;
  /**
   * Already-localized alt text (resolve sk/en at the call site, same convention as
   * localizeField elsewhere). Pass "" for a decorative hero image sitting behind its
   * own <h1> — the heading carries the meaning, the image doesn't need to repeat it.
   */
  alt: string;
  /** A real CMS-uploaded photo URL, when one exists for this slot. Always wins over
   * the generated art, with no code change at the call site. */
  photoUrl?: string | null;
  /** Hero images: eager + high priority. Everything else lazy (default). */
  priority?: boolean;
  className?: string;
  /** Physician initials — draws a monogram avatar instead of a scene illustration. */
  initials?: string;
}

/**
 * Renders a real photo when one is on file for `slot`; otherwise a branded
 * illustrated placeholder (packages/ui/src/placeholder-art.ts) so every page
 * presents fully dressed before real photography lands. See PLACEHOLDER_ART.md.
 */
export function HospitalImage({ slot, alt, photoUrl, priority = false, className, initials }: HospitalImageProps) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        fill
        sizes="100vw"
        className={cn('object-cover', className)}
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    );
  }

  const src = initials ? monogram(initials) : sceneDataUri(sceneFor(slot));
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative data-URI SVG; next/image can't optimize these and doesn't need to.
    <img
      id={slot}
      src={src}
      data-initials={initials || undefined}
      alt={alt}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      data-placeholder-art=""
    />
  );
}
