import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { VPrivCalDataset } from '../types';
import { withBasePath } from '../utils/assets';

interface DataContextValue {
  dataset: VPrivCalDataset | null;
  error: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

function isDataset(value: unknown): value is VPrivCalDataset {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VPrivCalDataset>;
  return (
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.images) &&
    candidate.images.length === 3 &&
    candidate.probeQuestions?.awarenessStatus?.options.length === 4 &&
    candidate.probeQuestions?.preferredAction?.options.length === 3
  );
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<DataContextValue>({ dataset: null, error: null });

  useEffect(() => {
    let active = true;
    fetch(withBasePath('data/vprivcal_detections.json'))
      .then((response) => {
        if (!response.ok) throw new Error(`Detection data returned ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isDataset(data)) throw new Error('Detection data does not match the expected schema.');
        if (active) setValue({ dataset: data, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setValue({
            dataset: null,
            error: error instanceof Error ? error.message : 'Unable to load detection data.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataset(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useDataset must be used inside DataProvider.');
  return value;
}

