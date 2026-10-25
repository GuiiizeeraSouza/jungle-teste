import Big from "big.js";

/**
 * Aritmética de ETH com precisão decimal. Entradas e saídas são strings —
 * nunca `number` — para não perder precisão em transporte ou cálculo.
 */
Big.DP = 18;
Big.RM = Big.roundHalfUp;

export type EthInput = string | Big;

const toBig = (value: EthInput) => (value instanceof Big ? value : new Big(value));

export const eth = {
  add: (...values: EthInput[]) => values.reduce<Big>((acc, v) => acc.plus(toBig(v)), new Big(0)).toString(),
  sub: (a: EthInput, b: EthInput) => toBig(a).minus(toBig(b)).toString(),
  mul: (a: EthInput, factor: EthInput | number) => toBig(a).times(factor).toString(),
  /** Arredonda para `dp` casas (padrão 2) — usado para preços de catálogo. */
  round: (a: EthInput, dp = 2) => toBig(a).round(dp, Big.roundHalfUp).toString(),
  max: (a: EthInput, b: EthInput) => (toBig(a).gte(toBig(b)) ? toBig(a).toString() : toBig(b).toString()),
  min: (a: EthInput, b: EthInput) => (toBig(a).lte(toBig(b)) ? toBig(a).toString() : toBig(b).toString()),
  cmp: (a: EthInput, b: EthInput) => toBig(a).cmp(toBig(b)),
  eq: (a: EthInput, b: EthInput) => toBig(a).eq(toBig(b)),
  isZero: (a: EthInput) => toBig(a).eq(0),
  /** Normaliza uma string decimal (remove zeros supérfluos). */
  normalize: (a: EthInput) => toBig(a).toString(),
};

/**
 * Formata para exibição seguindo o layout: mínimo de 2 casas ("1.19 ETH"),
 * preservando as casas significativas ("26.846 ETH", "0.016 ETH").
 */
export function formatEth(value: EthInput, options: { unit?: boolean; maxDecimals?: number } = {}) {
  const { unit = true, maxDecimals = 6 } = options;
  const big = toBig(value).round(maxDecimals, Big.roundHalfUp);
  const [, decimals = ""] = big.toFixed().split(".");
  const significant = decimals.replace(/0+$/, "").length;
  const text = big.toFixed(Math.max(2, significant));
  return unit ? `${text} ETH` : text;
}

/** Formato pt-BR com vírgula, usado no filtro de faixa de preço ("0,02 - 12,30 ETH"). */
export function formatEthBr(value: EthInput) {
  return toBig(value).toFixed(2).replace(".", ",");
}

/** Desconto conforme layout: "(-) 00.00" quando zero. */
export function formatDiscount(value: EthInput) {
  return eth.isZero(value) ? "(-) 00.00" : `(-) ${formatEth(value)}`;
}
