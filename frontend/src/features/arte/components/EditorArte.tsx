import Button from "@/components/ui/button/Button";
import { useEnviarImagem, useImagens } from "@/features/imagens/api";
import type { Imagem } from "@/features/imagens/types";
import {
  ChevronLeftIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  TrashBinIcon,
} from "@/icons";
import { REDE_LABEL, type Rede } from "@/lib/dominio";
import { cn } from "@/utils";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  areaDoTexto,
  baixarArquivos,
  carregarFonte,
  carregarImagem,
  desenharArte,
  exportarSlide,
  type ImagemFundo,
} from "../canvas";
import {
  clampCenter,
  corQueContrasta,
  coversArtwork,
  dentroDaCaixa,
  imageArea,
  limitarPonto,
  margem,
  TAMANHOS_ARTE,
  ZOOM_MAX,
  ZOOM_MIN,
  type AlinhamentoTexto,
  type Arte,
  type CaixaTexto,
  type FundoImagem,
  type PontoTexto,
  type PosicaoTexto,
} from "../layout";

const CORES_FUNDO = [
  "#465FFF",
  "#101828",
  "#FFFFFF",
  "#F2F4F7",
  "#F04438",
  "#F79009",
  "#12B76A",
  "#7A5AF8",
  "#EE46BC",
] as const;
const CORES_TEXTO = ["#FFFFFF", "#101828", "#FDB022", "#465FFF"] as const;
const ALINHAMENTOS: readonly AlinhamentoTexto[] = ["left", "center", "right"];
const POSICOES: readonly PosicaoTexto[] = ["top", "middle", "bottom"];
const AJUSTE_INICIAL: FundoImagem = {
  zoom: 1,
  x: 0.5,
  y: 0.5,
  escurecer: 0.3,
};
const FONTE_INICIAL = 72;

const tituloGrupo = "mb-2 text-sm font-medium text-gray-700 dark:text-gray-400";

/** Grupo de opções exclusivas (radio) com aparência de botões. */
function Segmentado<T extends string>({
  legenda,
  nome,
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  legenda: string;
  nome: string;
  opcoes: readonly T[];
  /** null = nenhuma opção marcada */
  valor: T | null;
  onChange: (v: T) => void;
  rotulo: (v: T) => ReactNode;
}) {
  return (
    <fieldset>
      <legend className={tituloGrupo}>{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label
            key={o}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-brand-500/20",
              o === valor
                ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300",
            )}
          >
            <input
              type="radio"
              name={nome}
              value={o}
              checked={o === valor}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {rotulo(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Amostras de cor + seletor livre. */
function Cores({
  legenda,
  cores,
  valor,
  onChange,
  rotuloOutra,
  rotuloCor,
}: {
  legenda: string;
  cores: readonly string[];
  valor: string;
  onChange: (cor: string) => void;
  rotuloOutra: string;
  rotuloCor: (cor: string) => string;
}) {
  return (
    <div role="group" aria-label={legenda}>
      <p className={tituloGrupo}>{legenda}</p>
      <div className="flex flex-wrap items-center gap-2">
        {cores.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={valor.toUpperCase() === c}
            aria-label={rotuloCor(c)}
            title={c}
            className={cn(
              "size-8 rounded-full border border-gray-300 dark:border-gray-700",
              valor.toUpperCase() === c &&
                "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-400 text-xs text-gray-500 dark:border-gray-600">
          <span aria-hidden>+</span>
          <input
            type="color"
            value={valor}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={rotuloOutra}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function Controle({
  id,
  rotulo,
  valor,
  texto,
  ...props
}: {
  id: string;
  rotulo: string;
  valor: number;
  /** Valor mostrado ao lado do rótulo */
  texto: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <label htmlFor={id} className="text-gray-700 dark:text-gray-400">
          {rotulo}
        </label>
        <span className="text-gray-500 tabular-nums dark:text-gray-400">
          {texto}
        </span>
      </div>
      <input
        id={id}
        type="range"
        value={valor}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}

type Slide = {
  /** Identificador local (não vai para a API) */
  id: string;
  tipoFundo: "color" | "image";
  cor: string;
  imagemId: string | null;
  ajuste: FundoImagem;
  texto: string;
  corTexto: string;
  fonte: number;
  alinhamento: AlinhamentoTexto;
  posicao: PosicaoTexto;
  /** Texto arrastado para um lugar livre; null = posição fixa */
  ponto: PontoTexto | null;
};

let sequencia = 0;
const novoId = () => `slide-${++sequencia}`;

const slideInicial = (texto: string): Slide => ({
  id: novoId(),
  tipoFundo: "color",
  cor: CORES_FUNDO[0],
  imagemId: null,
  ajuste: AJUSTE_INICIAL,
  texto,
  corTexto: corQueContrasta(CORES_FUNDO[0]),
  fonte: FONTE_INICIAL,
  alinhamento: "center",
  posicao: "middle",
  ponto: null,
});

const botaoSlide =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3";

/** Miniatura de um slide (canvas pequeno, redesenhado a cada mudança). */
function Miniatura({ arte, fundo }: { arte: Arte; fundo: ImagemFundo | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 2x a altura mostrada (64 px), para ficar nítida em telas de alta densidade
  const escala = 128 / arte.altura;
  useEffect(() => {
    if (ref.current) desenharArte(ref.current, arte, fundo, escala);
  });
  return (
    <canvas
      ref={ref}
      aria-hidden
      width={Math.round(arte.largura * escala)}
      height={128}
      className="h-16 w-auto rounded-sm"
    />
  );
}

/**
 * Editor de arte: imagem única (`maxSlides` = 1) ou carrossel (vários
 * slides no mesmo tamanho). Cada slide tem fundo (cor ou imagem da
 * biblioteca, recortada para cobrir a arte) e texto em posições fixas.
 * "Usar no post" exporta os slides, envia para a biblioteca e devolve as
 * imagens na ordem; "Baixar" só baixa os arquivos.
 */
export default function EditorArte({
  projetoId,
  rede,
  textoInicial,
  maxSlides,
  onCriadas,
  onCancelar,
}: {
  projetoId: string;
  rede: Rede;
  textoInicial: string;
  /** 1 = imagem única; acima disso, carrossel com até esse número de slides */
  maxSlides: number;
  onCriadas: (imagens: Imagem[]) => void;
  onCancelar: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "art" });
  const imagens = useImagens(projetoId);
  const enviar = useEnviarImagem();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carrossel = maxSlides > 1;

  const tamanhos = TAMANHOS_ARTE[rede];
  const [indiceTamanho, setIndiceTamanho] = useState("0");
  const tamanho = tamanhos[Number(indiceTamanho)] ?? tamanhos[0];

  const [slides, setSlides] = useState<Slide[]>(() => [
    slideInicial(textoInicial),
  ]);
  const [ativo, setAtivo] = useState(0);
  const atual = slides[ativo] ?? slides[0];

  // Imagens de fundo decodificadas, por id da imagem (compartilhadas entre slides)
  const [bitmaps, setBitmaps] = useState<Record<string, ImagemFundo>>({});
  const [carregando, setCarregando] = useState<Record<string, boolean>>({});
  const [comErro, setComErro] = useState<Record<string, boolean>>({});
  const bitmapsRef = useRef(bitmaps);
  useEffect(() => {
    bitmapsRef.current = bitmaps;
  });
  // Libera as imagens decodificadas ao fechar o editor
  useEffect(
    () => () => Object.values(bitmapsRef.current).forEach((b) => b.close()),
    [],
  );

  const [fontePronta, setFontePronta] = useState(false);
  /** Slide sendo enviado (1, 2, ...) ou null */
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erroBaixar, setErroBaixar] = useState(false);
  /** Slides já enviados: tentar de novo após um erro não reenvia os mesmos */
  const enviadas = useRef(
    new Map<string, { assinatura: string; imagem: Imagem }>(),
  );

  const fundoDo = (s: Slide) =>
    s.tipoFundo === "image" && s.imagemId
      ? (bitmaps[s.imagemId] ?? null)
      : null;
  const arteDo = (s: Slide): Arte => ({
    largura: tamanho.largura,
    altura: tamanho.altura,
    cor: s.cor,
    imagem: fundoDo(s) ? s.ajuste : null,
    texto: s.texto,
    corTexto: s.corTexto,
    fonte: s.fonte,
    alinhamento: s.alinhamento,
    posicao: s.posicao,
    ponto: s.ponto,
  });

  const fundo = fundoDo(atual);
  const arte = arteDo(atual);
  const comFoto = fundo !== null;
  // The background color shows when the image is smaller or moved aside
  const fotoCobre =
    fundo !== null &&
    coversArtwork(
      imageArea(
        { largura: fundo.width, altura: fundo.height },
        tamanho,
        atual.ajuste,
      ),
      tamanho,
    );
  const ajusteInicial =
    atual.ajuste.zoom === AJUSTE_INICIAL.zoom &&
    atual.ajuste.x === AJUSTE_INICIAL.x &&
    atual.ajuste.y === AJUSTE_INICIAL.y;
  const imagemDoAtual = atual.tipoFundo === "image" ? atual.imagemId : null;
  const carregandoAtual =
    imagemDoAtual !== null && Boolean(carregando[imagemDoAtual]);
  const erroImagem = imagemDoAtual !== null && Boolean(comErro[imagemDoAtual]);
  const algumCarregando = Object.values(carregando).some(Boolean);
  const ocupado =
    salvando !== null || baixando || !fontePronta || algumCarregando;

  useEffect(() => {
    let vivo = true;
    void carregarFonte().then(() => vivo && setFontePronta(true));
    return () => {
      vivo = false;
    };
  }, []);

  // Redesenha a cada mudança (a arte inteira leva poucos milissegundos)
  useEffect(() => {
    if (canvasRef.current) desenharArte(canvasRef.current, arte, fundo);
  });

  /** Muda campos do slide atual. */
  const atualizar = (parcial: Partial<Slide>) =>
    setSlides((lista) =>
      lista.map((s, i) => (i === ativo ? { ...s, ...parcial } : s)),
    );
  const setAjuste = (ajuste: FundoImagem) => atualizar({ ajuste });

  const escolherCor = (cor: string) =>
    atualizar({ cor, corTexto: corQueContrasta(cor) });

  const escolherImagem = async (imagem: Imagem) => {
    atualizar({
      imagemId: imagem.id,
      ajuste: AJUSTE_INICIAL,
      corTexto: "#FFFFFF",
    });
    if (bitmaps[imagem.id] || carregando[imagem.id]) return;
    setComErro((e) => ({ ...e, [imagem.id]: false }));
    setCarregando((c) => ({ ...c, [imagem.id]: true }));
    try {
      const bitmap = await carregarImagem(imagem.url);
      setBitmaps((b) => ({ ...b, [imagem.id]: bitmap }));
    } catch {
      setComErro((e) => ({ ...e, [imagem.id]: true }));
    } finally {
      setCarregando((c) => ({ ...c, [imagem.id]: false }));
    }
  };

  // --- slides do carrossel ---------------------------------------------------
  const cheio = slides.length >= maxSlides;
  /** Insere depois do atual e passa a editá-lo. */
  const inserir = (slide: Slide) => {
    if (cheio) return;
    setSlides((lista) => [
      ...lista.slice(0, ativo + 1),
      slide,
      ...lista.slice(ativo + 1),
    ]);
    setAtivo(ativo + 1);
  };
  /** Novo slide com o mesmo visual do atual e sem texto. */
  const adicionarSlide = () => inserir({ ...atual, id: novoId(), texto: "" });
  const duplicarSlide = () => inserir({ ...atual, id: novoId() });
  const removerSlide = () => {
    if (slides.length === 1) return;
    setSlides((lista) => lista.filter((_, i) => i !== ativo));
    setAtivo(Math.max(0, ativo - 1));
  };
  const moverSlide = (delta: number) => {
    const destino = ativo + delta;
    if (destino < 0 || destino >= slides.length) return;
    setSlides((lista) => {
      const nova = [...lista];
      const [item] = nova.splice(ativo, 1);
      nova.splice(destino, 0, item);
      return nova;
    });
    setAtivo(destino);
  };

  // Dragging the preview: over the text, moves the text; elsewhere, moves the
  // background image (freely, like the text)
  const arraste = useRef<
    | { tipo: "texto"; x: number; y: number; caixa: CaixaTexto }
    | { tipo: "imagem"; x: number; y: number; ajuste: FundoImagem }
    | null
  >(null);
  const [sobreTexto, setSobreTexto] = useState(false);

  /** Posição do ponteiro em pixels da arte (a prévia é reduzida pelo CSS). */
  const pontoNaArte = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const escala = r.width > 0 ? tamanho.largura / r.width : 1;
    return {
      x: (e.clientX - r.left) * escala,
      y: (e.clientY - r.top) * escala,
      escala,
    };
  };
  /** Bloco de texto sob o ponteiro (com folga para facilitar no celular). */
  const textoSob = (e: PointerEvent<HTMLCanvasElement>) => {
    const caixa = areaDoTexto(arte);
    if (!caixa) return null;
    const p = pontoNaArte(e);
    // Folga de ~12 px na tela, convertida para pixels da arte
    return dentroDaCaixa(caixa, p.x, p.y, 12 * p.escala) ? caixa : null;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const caixa = textoSob(e);
    if (caixa) {
      arraste.current = { tipo: "texto", x: e.clientX, y: e.clientY, caixa };
    } else if (comFoto) {
      arraste.current = {
        tipo: "imagem",
        x: e.clientX,
        y: e.clientY,
        ajuste: atual.ajuste,
      };
    } else {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const inicio = arraste.current;
    if (!inicio) {
      // Sem arrastar: só muda o cursor quando passa sobre o texto
      const sobre = textoSob(e) !== null;
      if (sobre !== sobreTexto) setSobreTexto(sobre);
      return;
    }
    const { escala } = pontoNaArte(e);
    const dx = (e.clientX - inicio.x) * escala;
    const dy = (e.clientY - inicio.y) * escala;

    if (inicio.tipo === "texto") {
      const { caixa } = inicio;
      const centro = {
        x: (caixa.esquerda + caixa.largura / 2 + dx) / tamanho.largura,
        y: (caixa.topo + caixa.altura / 2 + dy) / tamanho.altura,
      };
      atualizar({
        ponto: limitarPonto(centro, tamanho, caixa, margem(tamanho)),
      });
      return;
    }

    // The image follows the pointer; its center stays inside the artwork
    setAjuste({
      ...inicio.ajuste,
      x: clampCenter(inicio.ajuste.x + dx / tamanho.largura),
      y: clampCenter(inicio.ajuste.y + dy / tamanho.altura),
    });
  };
  const fimArraste = () => {
    arraste.current = null;
  };

  const descricaoDo = (s: Slide, i: number) =>
    s.texto.trim().slice(0, 300) ||
    (carrossel ? t("slideDescription", { n: i + 1 }) : t("defaultDescription"));

  const salvar = async () => {
    setErroSalvar(false);
    try {
      const criadas: Imagem[] = [];
      for (const [i, s] of slides.entries()) {
        setSalvando(i + 1);
        const arteSlide = arteDo(s);
        const assinatura = JSON.stringify(arteSlide) + (s.imagemId ?? "");
        const anterior = enviadas.current.get(s.id);
        if (anterior?.assinatura === assinatura) {
          criadas.push(anterior.imagem);
          continue;
        }
        const arquivo = await exportarSlide(arteSlide, fundoDo(s));
        const imagem = await enviar.mutateAsync({
          projetoId,
          arquivo,
          descricao: descricaoDo(s, i),
        });
        enviadas.current.set(s.id, { assinatura, imagem });
        criadas.push(imagem);
      }
      onCriadas(criadas);
    } catch {
      setErroSalvar(true);
      setSalvando(null);
    }
  };

  /** Só baixa a arte (ex.: para publicar fora do PostPilot); nada é salvo. */
  const baixar = async () => {
    setErroBaixar(false);
    setBaixando(true);
    try {
      const base = `postpilot-${rede}-${tamanho.largura}x${tamanho.altura}`;
      const arquivos: { arquivo: File; nome: string }[] = [];
      for (const [i, s] of slides.entries()) {
        const arquivo = await exportarSlide(arteDo(s), fundoDo(s));
        const extensao = arquivo.type === "image/png" ? "png" : "jpg";
        const numero = carrossel ? `-${String(i + 1).padStart(2, "0")}` : "";
        arquivos.push({ arquivo, nome: `${base}${numero}.${extensao}` });
      }
      await baixarArquivos(arquivos);
    } catch {
      setErroBaixar(true);
    } finally {
      setBaixando(false);
    }
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const rotuloCor = (c: string) => t("colorOption", { color: c });

  return (
    <div>
      <h3 className="pe-10 text-lg font-semibold text-gray-800 dark:text-white/90">
        {carrossel
          ? t("titleCarousel", { network: REDE_LABEL[rede] })
          : t("title", { network: REDE_LABEL[rede] })}
      </h3>
      <p className="mt-1 pe-10 text-sm text-gray-500 dark:text-gray-400">
        {carrossel ? t("subtitleCarousel", { max: maxSlides }) : t("subtitle")}
      </p>

      {carrossel && (
        <div className="mt-5" role="group" aria-label={t("slides")}>
          <ol className="flex items-end gap-3 overflow-x-auto p-1">
            {slides.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setAtivo(i)}
                  aria-current={i === ativo ? "true" : undefined}
                  aria-label={t("slideN", { n: i + 1 })}
                  className={cn(
                    "relative block rounded-md border-2 p-0.5",
                    i === ativo
                      ? "border-brand-500"
                      : "border-transparent hover:border-brand-300",
                  )}
                >
                  <Miniatura arte={arteDo(s)} fundo={fundoDo(s)} />
                  <span className="absolute start-1 top-1 flex size-5 items-center justify-center rounded-full bg-gray-900/75 text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <button
                type="button"
                onClick={adicionarSlide}
                disabled={cheio}
                aria-label={t("addSlide")}
                title={t("addSlide")}
                className="flex h-[72px] w-14 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-brand-500 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-brand-400"
              >
                <PlusIcon aria-hidden className="size-5" />
              </button>
            </li>
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="me-auto text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
              {t("slideCount", {
                n: ativo + 1,
                total: slides.length,
                max: maxSlides,
              })}
            </p>
            <button
              type="button"
              className={botaoSlide}
              onClick={() => moverSlide(-1)}
              disabled={ativo === 0}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
              {t("moveSlideLeft")}
            </button>
            <button
              type="button"
              className={botaoSlide}
              onClick={() => moverSlide(1)}
              disabled={ativo === slides.length - 1}
            >
              {t("moveSlideRight")}
              <ChevronLeftIcon aria-hidden className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              className={botaoSlide}
              onClick={duplicarSlide}
              disabled={cheio}
            >
              <CopyIcon aria-hidden className="size-4" />
              {t("duplicateSlide")}
            </button>
            <button
              type="button"
              className={botaoSlide}
              onClick={removerSlide}
              disabled={slides.length === 1}
            >
              <TrashBinIcon aria-hidden className="size-4" />
              {t("removeSlide")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Prévia em tamanho real, reduzida pelo CSS */}
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-gray-100 p-3 sm:p-4 dark:bg-gray-800/60">
          <canvas
            ref={canvasRef}
            width={tamanho.largura}
            height={tamanho.altura}
            role="img"
            aria-label={t("previewLabel", {
              size: `${tamanho.largura} × ${tamanho.altura}`,
            })}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={fimArraste}
            onPointerCancel={fimArraste}
            onPointerLeave={() => setSobreTexto(false)}
            className={cn(
              "h-auto max-h-[45vh] w-auto max-w-full touch-none rounded-md shadow-theme-md lg:max-h-[65vh]",
              (comFoto || sobreTexto) && "cursor-move",
            )}
          />
        </div>

        <div className="space-y-5">
          <Segmentado
            legenda={carrossel ? t("sizeCarousel") : t("size")}
            nome="arte-tamanho"
            opcoes={tamanhos.map((_, i) => String(i))}
            valor={indiceTamanho}
            onChange={setIndiceTamanho}
            rotulo={(i) => {
              const tm = tamanhos[Number(i)];
              return `${tm.largura} × ${tm.altura} · ${tm.proporcao}`;
            }}
          />

          <Segmentado
            legenda={t("background")}
            nome="arte-fundo"
            opcoes={["color", "image"] as const}
            valor={atual.tipoFundo}
            onChange={(tipoFundo) => atualizar({ tipoFundo })}
            rotulo={(o) => t(`backgroundTypes.${o}`)}
          />

          {atual.tipoFundo === "color" ? (
            <Cores
              legenda={t("backgroundColor")}
              cores={CORES_FUNDO}
              valor={atual.cor}
              onChange={escolherCor}
              rotuloOutra={t("otherBackgroundColor")}
              rotuloCor={rotuloCor}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <p className={tituloGrupo}>{t("libraryImage")}</p>
                {imagens.isError ? (
                  <p role="alert" className="text-sm text-error-600">
                    {t("libraryError")}
                  </p>
                ) : imagens.isLoading ? (
                  <div
                    aria-hidden
                    className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                  />
                ) : !imagens.data?.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("emptyLibrary")}{" "}
                    <Link
                      to="/images"
                      className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      {t("goToLibrary")}
                    </Link>
                  </p>
                ) : (
                  <ul className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto p-0.5">
                    {imagens.data.map((imagem, i) => (
                      <li key={imagem.id}>
                        <button
                          type="button"
                          onClick={() => void escolherImagem(imagem)}
                          aria-pressed={imagem.id === atual.imagemId}
                          aria-label={
                            imagem.description ?? t("imageOption", { n: i + 1 })
                          }
                          className={cn(
                            "block aspect-square w-full overflow-hidden rounded-lg border-2",
                            imagem.id === atual.imagemId
                              ? "border-brand-500"
                              : "border-transparent hover:border-brand-300",
                          )}
                        >
                          <img
                            src={imagem.url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {carregandoAtual && (
                  <p role="status" className="mt-2 text-sm text-gray-500">
                    {t("loadingImage")}
                  </p>
                )}
                {erroImagem && (
                  <p role="alert" className="mt-2 text-sm text-error-600">
                    {t("imageError")}
                  </p>
                )}
              </div>

              {comFoto && (
                <div className="space-y-3">
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("dragHint")}
                  </p>
                  <Controle
                    id="arte-zoom"
                    rotulo={t("zoom")}
                    valor={atual.ajuste.zoom}
                    texto={pct(atual.ajuste.zoom)}
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step={0.05}
                    onChange={(zoom) => setAjuste({ ...atual.ajuste, zoom })}
                  />
                  <Controle
                    id="arte-imagem-x"
                    rotulo={t("horizontal")}
                    valor={atual.ajuste.x}
                    texto={pct(atual.ajuste.x)}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(x) => setAjuste({ ...atual.ajuste, x })}
                  />
                  <Controle
                    id="arte-imagem-y"
                    rotulo={t("vertical")}
                    valor={atual.ajuste.y}
                    texto={pct(atual.ajuste.y)}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(y) => setAjuste({ ...atual.ajuste, y })}
                  />
                  <button
                    type="button"
                    className={botaoSlide}
                    disabled={ajusteInicial}
                    onClick={() =>
                      setAjuste({
                        ...AJUSTE_INICIAL,
                        escurecer: atual.ajuste.escurecer,
                      })
                    }
                  >
                    {t("coverArtwork")}
                  </button>
                  <Controle
                    id="arte-escurecer"
                    rotulo={t("darken")}
                    valor={atual.ajuste.escurecer}
                    texto={pct(atual.ajuste.escurecer)}
                    min={0}
                    max={0.8}
                    step={0.05}
                    onChange={(escurecer) =>
                      setAjuste({ ...atual.ajuste, escurecer })
                    }
                  />
                  {!fotoCobre && (
                    // Color around the image (the text color stays: it sits on the photo)
                    <Cores
                      legenda={t("colorAroundImage")}
                      cores={CORES_FUNDO}
                      valor={atual.cor}
                      onChange={(cor) => atualizar({ cor })}
                      rotuloOutra={t("otherBackgroundColor")}
                      rotuloCor={rotuloCor}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
            <div>
              <label htmlFor="arte-texto" className={`${tituloGrupo} block`}>
                {carrossel ? t("slideText", { n: ativo + 1 }) : t("text")}
              </label>
              <textarea
                id="arte-texto"
                rows={3}
                value={atual.texto}
                onChange={(e) => atualizar({ texto: e.target.value })}
                placeholder={t("textPlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {t("textHint")}
              </p>
            </div>
            <Controle
              id="arte-fonte"
              rotulo={t("fontSize")}
              valor={atual.fonte}
              texto={`${atual.fonte} px`}
              min={32}
              max={160}
              step={2}
              onChange={(fonte) => atualizar({ fonte })}
            />
            <Cores
              legenda={t("textColor")}
              cores={CORES_TEXTO}
              valor={atual.corTexto}
              onChange={(corTexto) => atualizar({ corTexto })}
              rotuloOutra={t("otherTextColor")}
              rotuloCor={rotuloCor}
            />
            <Segmentado
              legenda={t("align")}
              nome="arte-alinhamento"
              opcoes={ALINHAMENTOS}
              valor={atual.alinhamento}
              onChange={(alinhamento) => atualizar({ alinhamento })}
              rotulo={(a) => t(`alignments.${a}`)}
            />
            <div>
              <Segmentado
                legenda={t("position")}
                nome="arte-posicao"
                opcoes={POSICOES}
                // Texto arrastado: nenhuma posição fixa marcada
                valor={atual.ponto ? null : atual.posicao}
                onChange={(posicao) => atualizar({ posicao, ponto: null })}
                rotulo={(p) => t(`positions.${p}`)}
              />
              <p
                aria-live="polite"
                className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400"
              >
                {atual.ponto ? t("positionFree") : t("dragTextHint")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {(erroSalvar || erroBaixar) && (
        <p role="alert" className="mt-5 text-sm text-error-600">
          {erroSalvar ? t("saveError") : t("downloadError")}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void baixar()}
          disabled={ocupado}
          startIcon={<DownloadIcon aria-hidden className="size-5" />}
          className="sm:me-auto"
        >
          {baixando
            ? t("downloading")
            : carrossel
              ? t("downloadSlides", { count: slides.length })
              : t("download")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void salvar()}
          disabled={ocupado}
          className="sm:min-w-40"
        >
          {salvando !== null
            ? carrossel
              ? t("savingSlides", { n: salvando, total: slides.length })
              : t("saving")
            : carrossel
              ? t("useSlides", { count: slides.length })
              : t("use")}
        </Button>
      </div>
    </div>
  );
}
