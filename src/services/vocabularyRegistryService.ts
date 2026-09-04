import { validateVocabularyPackage, validateVocabularyRegistry, type VocabularyPackageFile, type VocabularyRegistry } from '../domain/vocabulary';

const DEFAULT_REGISTRY_URL = import.meta.env.VITE_VOCABULARY_REGISTRY_URL ?? '/api/vocabularies/registry.json';

export async function fetchVocabularyRegistry(url = DEFAULT_REGISTRY_URL): Promise<VocabularyRegistry> {
  const payload = await fetchJson(url);
  return validateVocabularyRegistry(payload);
}

export async function downloadVocabularyPackage(downloadUrl: string, mirrorUrls: string[] = []): Promise<{ packageFile: VocabularyPackageFile; sourceUrl: string }> {
  const urls = [downloadUrl, ...mirrorUrls];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const payload = await fetchJson(url);
      return {
        packageFile: validateVocabularyPackage(payload),
        sourceUrl: url,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('词库下载失败');
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`词库请求失败：${url}`);
  }
  return response.json();
}
