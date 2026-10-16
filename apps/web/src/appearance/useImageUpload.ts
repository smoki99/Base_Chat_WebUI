import { useCallback, useState } from 'react';
import { imageErrorMessage, processImageFile } from './imageUtils';

/** Small hook wrapping image validation, downsampling and error handling. */
export function useImageUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(async (file: File | null): Promise<string | null> => {
    if (!file) {
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const image = await processImageFile(file);
      return image.dataUrl;
    } catch (err) {
      setError(imageErrorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { pickFile, busy, error, clearError };
}
