import type { FormatoPost, Rede, StatusPost } from "@/lib/dominio";

export const REDES: readonly Rede[] = ["linkedin", "instagram", "x"];

/** Limite de caracteres de cada rede (texto + hashtags). */
export const LIMITE_CARACTERES: Record<Rede, number> = {
  linkedin: 3000,
  instagram: 2200,
  x: 280,
};

// Regras por rede. O backend valida as mesmas (schemas/posts.py).

/** Formatos aceitos por rede, na ordem em que aparecem no formulário. */
export const FORMATOS_POR_REDE: Record<Rede, readonly FormatoPost[]> = {
  instagram: ["single", "carousel"],
  linkedin: ["text", "single", "carousel"],
  x: ["text", "single", "carousel"],
};

/** Máximo de imagens por post (carrossel do Instagram e do LinkedIn, até 4 no X). */
export const MAXIMO_IMAGENS: Record<Rede, number> = {
  instagram: 20,
  linkedin: 20,
  x: 4,
};

/** Caracteres que aparecem antes do "ver mais" (null = o post inteiro). */
export const VISIVEL_ANTES_DO_MAIS: Record<Rede, number | null> = {
  instagram: 125,
  linkedin: 210,
  x: null,
};

/** Quantas imagens o formato aceita na rede. */
export function maximoImagens(rede: Rede, formato: FormatoPost): number {
  if (formato === "text") return 0;
  if (formato === "single") return 1;
  return MAXIMO_IMAGENS[rede];
}

/** Status em que o post precisa estar completo (rascunhos podem ficar sem imagem). */
const STATUS_PRONTO: readonly StatusPost[] = ["approved", "published"];

export type ErroRegra = {
  campo: "format" | "content" | "image_ids";
  /** Chave de tradução (namespace "app") */
  mensagem: string;
  valores?: Record<string, string | number>;
};

/** Primeira regra da rede que o post quebra, ou null. */
export function erroRegraPost(post: {
  network: Rede;
  format: FormatoPost;
  imagens: number;
  texto: string;
  status: StatusPost;
}): ErroRegra | null {
  const { network, format, imagens, texto, status } = post;
  if (!FORMATOS_POR_REDE[network].includes(format)) {
    return {
      campo: "format",
      mensagem: "posts.form.errors.formatNotAvailable",
    };
  }
  if (contarCaracteres(texto, []) > LIMITE_CARACTERES[network]) {
    return {
      campo: "content",
      mensagem: "posts.form.errors.tooLongForNetwork",
      valores: { limit: LIMITE_CARACTERES[network] },
    };
  }
  const maximo = maximoImagens(network, format);
  if (imagens > maximo) {
    return {
      campo: "image_ids",
      mensagem: "posts.form.errors.tooManyImages",
      valores: { max: maximo },
    };
  }
  if (STATUS_PRONTO.includes(status)) {
    if (format === "single" && imagens !== 1) {
      return {
        campo: "image_ids",
        mensagem: "posts.form.errors.needsOneImage",
      };
    }
    if (format === "carousel" && imagens < 2) {
      return {
        campo: "image_ids",
        mensagem: "posts.form.errors.needsTwoImages",
      };
    }
  }
  return null;
}

/** "#nuvem, marketing  #Nuvem" → ["nuvem", "marketing"] (sem repetir, sem #). */
export function parseHashtags(entrada: string): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const parte of entrada.split(/[\s,]+/)) {
    const tag = parte.replace(/^#+/, "").trim();
    if (tag && !vistas.has(tag.toLowerCase())) {
      vistas.add(tag.toLowerCase());
      resultado.push(tag);
    }
  }
  return resultado;
}

export function formatarHashtags(hashtags: string[]): string {
  return hashtags.map((h) => `#${h}`).join(" ");
}

/** Texto como será publicado: texto, linha em branco e as hashtags. */
export function textoFinal(texto: string, hashtags: string[]): string {
  const tags = formatarHashtags(hashtags);
  return tags ? `${texto.trim()}\n\n${tags}` : texto.trim();
}

export function contarCaracteres(texto: string, hashtags: string[]): number {
  // Array.from conta emojis e acentos combinados como um caractere
  return Array.from(textoFinal(texto, hashtags)).length;
}
