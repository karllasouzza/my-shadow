/**
 * Slice 4: RAG Content Seed Service
 *
 * Provides initial Jungian shadow work content for the RAG vector store.
 * Seeds meaningful excerpts about shadow work, projection, individuation,
 * collective unconscious, and archetypes in Brazilian Portuguese.
 *
 * Uses the existing ReflectionRAGRepository to store embeddings.
 */

import { Result, createError, err, ok } from "../utils/app-error";
import { getReflectionRAGRepository } from "./reflection-rag-repository";

export interface RagSeedEntry {
  id: string;
  text: string;
  category:
    | "shadow"
    | "projection"
    | "individuation"
    | "collective_unconscious"
    | "archetype";
}

/**
 * Jungian seed content — excerpts about shadow work in Brazilian Portuguese.
 * Each entry represents a core Jungian concept or philosophical excerpt.
 */
export const JUNGIAN_SEED_CONTENT: RagSeedEntry[] = [
  {
    id: "seed-shadow-001",
    text: "A sombra e o lado oculto da personalidade, o conjunto de qualidades que o ego nao reconhece em si mesmo. Ela contem tudo o que o individuo recusa ver sobre si proprio, mas que se manifesta nas reacoes emocionais desproporcionais, nas projeccoes e nos comportamentos automaticos.",
    category: "shadow",
  },
  {
    id: "seed-shadow-002",
    text: "O encontro com a propria sombra e uma tarefa moral que exige coragem. Nao se trata de eliminar a sombra, mas de reconhece-la como parte integrante da psique. A integracao da sombra e o primeiro passo do processo de individuacao, pois so podemos nos tornar inteiros quando aceitamos nossa totalidade.",
    category: "shadow",
  },
  {
    id: "seed-shadow-003",
    text: "Tudo que nos irrita nos outros pode nos levar a uma compreensao de nos mesmos. A projecao e o mecanismo pelo qual atribuiamos ao outro qualidades que nao reconhecemos em nos. Quando dizemos alguem e insuportavel, podemos estar projetando nossa propria insuportabilidade recalcada.",
    category: "projection",
  },
  {
    id: "seed-shadow-004",
    text: "A projecao e sempre um sinal de que algo nao foi integrado. Ela funciona como um espelho que reflete conteudos inconscientes. O trabalho de reflexao consiste em trazer de volta essas projecoes, reconhecendo que o que vemos no outro e, frequentemente, um fragmento de nos mesmos que ainda nao acolhemos.",
    category: "projection",
  },
  {
    id: "seed-shadow-005",
    text: "A individuacao e o processo pelo qual o individuo se torna o que realmente e, distinguindo-se do coletivo. Nao significa isolamento ou egoismo, mas sim a realizacao da propria natureza psiquica. E uma jornada de diferenciacao que conduz a uma consciencia mais ampla e compassiva de si e do outro.",
    category: "individuation",
  },
  {
    id: "seed-shadow-006",
    text: "O processo de individuacao exige que enfrentemos a persona que apresentamos ao mundo e a sombra que escondemos de nos mesmos. So quando retiramos as identificacoes falsas e assumimos nossas contradicoes e que podemos caminhar em direcao a totalidade do self.",
    category: "individuation",
  },
  {
    id: "seed-shadow-007",
    text: "O inconsciente coletivo e o deposito das experiencias acumuladas pela humanidade ao longo de milenios. Ele contem os arquetypes, que sao padroes universais de comportamento e simbolismo. Cada pessoa carrega em si essa heranca psiquica comum a toda especie humana.",
    category: "collective_unconscious",
  },
  {
    id: "seed-shadow-008",
    text: "Os sonhos sao a via regia de acesso ao inconsciente coletivo. Atraves deles, os arquetypes se manifestam em forma de imagens simbolicas que falam uma linguagem universal. Sonhar com figuras como o velho sabio, a grande mae ou a crianca divina revela conteudos que transcendem a experiencia pessoal.",
    category: "collective_unconscious",
  },
  {
    id: "seed-shadow-009",
    text: "Os arquetypes nao sao conteudos herdados, mas sim formas vazias que se preenchem com a experiencia de cada cultura e individuo. A sombra, a persona, a anima e o animus sao arquetypes fundamentais que estruturam a psique e orientam o desenvolvimento da personalidade.",
    category: "archetype",
  },
  {
    id: "seed-shadow-010",
    text: "A persona e a mascara social que utilizamos para nos adaptar ao mundo externo. Ela e necessaria para a vida em sociedade, mas torna-se patologica quando o individuo se identifica exclusivamente com ela, perdendo contato com sua essencia. O trabalho com a sombra exige que questionemos: quem sou eu alem dos papeis que represento?",
    category: "archetype",
  },
  {
    id: "seed-shadow-011",
    text: "Quem olha para fora, sonha. Quem olha para dentro, desperta. A jornada de autoconhecimento requer uma volta para o interior, um exame honesto das proprias motivacoes, medos e desejos. So atraves dessa introspeccao corajosa e possivel transcender os padroes inconscientes que nos aprisionam.",
    category: "shadow",
  },
  {
    id: "seed-shadow-012",
    text: "Nao se torna iluminado imaginando figuras de luz, mas tornando a escuridao consciente. A sombra nao e apenas negativa; ela contem tambem potencialidades nao desenvolvidas, talentos suprimidos e energias vitais que foram recalcadas. Integrar a sombra e libertar essas energias para uma vida mais autentica.",
    category: "shadow",
  },
  {
    id: "seed-shadow-013",
    text: "O trabalho com a sombra exige humildade. Reconhecer que somos capazes de tudo que condenamos nos outros e um ato de honestidade radical. Essa reconhece nao nos torna piores, mas mais humanos e mais capazes de compaixao, pois entendemos que a linha entre luz e escuridao atravessa cada coracao humano.",
    category: "shadow",
  },
  {
    id: "seed-shadow-014",
    text: "A neurose e sempre um substituto do sofrimento legitimo. Quando evitamos enfrentar nossa sombra, pagamos o preco em forma de ansiedade, depressao ou comportamentos autodestrutivos. O caminho da cura passa pela aceitacao da dor que tentamos evitar e pela coragem de olhar para o que recusamos ver.",
    category: "individuation",
  },
  {
    id: "seed-shadow-015",
    text: "O self e o arquetype da totalidade, o centro organizador que une consciente e inconsciente. Ele se manifesta em sonhos como figuras de mandala, circulo ou totalidade. A individuacao e o processo de aproximar-se do self, nao como destino final, mas como direcao permanente de crescimento e integracao.",
    category: "individuation",
  },
];

const SEED_MARKER_KEY = "rag-seed-initialized-v1";

/**
 * Initialize and seed the RAG content store if empty.
 * Checks if seed content already exists before inserting.
 */
export async function initRagContentSeed(): Promise<Result<void>> {
  try {
    const repository = getReflectionRAGRepository();

    const initResult = await repository.initialize();
    if (!initResult.success) {
      return err(initResult.error);
    }

    const alreadySeeded = await verifySeed();
    if (alreadySeeded.success && alreadySeeded.data) {
      return ok(undefined);
    }

    const seedResults = await Promise.allSettled(
      JUNGIAN_SEED_CONTENT.map((entry) =>
        repository.storeEmbedding({
          id: entry.id,
          reflectionId: `seed-${entry.category}`,
          text: entry.text,
          metadata: {
            entryDate: new Date().toISOString(),
            moodTags: [entry.category],
            triggerTags: ["seed", "jungian"],
          },
        }),
      ),
    );

    const failures = seedResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    if (failures.length > 0) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Falha ao semear conteudo RAG: ${failures.length} de ${JUNGIAN_SEED_CONTENT.length} entradas falharam`,
          { failures: failures.length, total: JUNGIAN_SEED_CONTENT.length },
        ),
      );
    }

    try {
      const mmkv = require("react-native-mmkv").MMKV;
      const storage = new mmkv();
      storage.set(SEED_MARKER_KEY, true);
    } catch {
      // MMKV not available — seed marker not critical
    }

    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Erro ao inicializar semente de conteudo RAG",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Check if seed content has already been stored.
 * Verifies by searching for known seed IDs in the vector store.
 */
export async function verifySeed(): Promise<Result<boolean>> {
  try {
    const repository = getReflectionRAGRepository();

    // Check MMKV marker first for fast path
    try {
      const mmkv = require("react-native-mmkv").MMKV;
      const storage = new mmkv();
      const marker = storage.getBoolean(SEED_MARKER_KEY);
      if (marker === true) {
        return ok(true);
      }
    } catch {
      // MMKV not available — continue with vector store check
    }

    // Verify by searching for a known seed entry
    const firstSeed = JUNGIAN_SEED_CONTENT[0];
    if (!firstSeed) {
      return ok(false);
    }

    const searchResult = await repository.searchByText(firstSeed.text, 1, 0.9);
    if (!searchResult.success) {
      // If search fails, assume not seeded (could be uninitialized store)
      return ok(false);
    }

    const found = searchResult.data.length > 0;
    return ok(found);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Erro ao verificar semente de conteudo RAG",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Clear all seed content and re-seed from scratch.
 * Use this to refresh the vector store with updated seed content.
 */
export async function reseedContent(): Promise<Result<void>> {
  try {
    const repository = getReflectionRAGRepository();

    // Clear existing seed entries
    const deleteResults = await Promise.allSettled(
      JUNGIAN_SEED_CONTENT.map((entry) =>
        repository.deleteEmbedding(`seed-${entry.category}`),
      ),
    );

    const failures = deleteResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    if (failures.length > 0) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Falha ao limpar conteudo RAG antes do reseed`,
          { failures: failures.length },
        ),
      );
    }

    // Clear the MMKV marker
    try {
      const mmkv = require("react-native-mmkv").MMKV;
      const storage = new mmkv();
      storage.delete(SEED_MARKER_KEY);
    } catch {
      // MMKV not available — non-critical
    }

    // Re-seed
    return initRagContentSeed();
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Erro ao resemar conteudo RAG",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Generate a unique ID for a new seed entry.
 * Uses timestamp + random component for uniqueness.
 */
export function generateSeedId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `seed-${timestamp}-${randomPart}`;
}
