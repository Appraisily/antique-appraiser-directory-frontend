import React, { useState } from 'react';
import { DEFAULT_PLACEHOLDER_IMAGE } from '../../config/assets';

interface FallbackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

/**
 * An image component that automatically handles loading errors by displaying a fallback image
 */
export function FallbackImage({
  src,
  alt,
  fallbackSrc = DEFAULT_PLACEHOLDER_IMAGE,
  className,
  ...props
}: FallbackImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src || '');
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
  };

  // If no source was provided, use fallback immediately
  React.useEffect(() => {
    if (!src) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    } else {
      setImgSrc(src);
      setHasError(false);
    }
  }, [src, fallbackSrc]);

  return (
    <img
      src={imgSrc}
      alt={alt || 'Image'}
      onError={handleError}
      className={className}
      {...props}
    />
  );
} 
