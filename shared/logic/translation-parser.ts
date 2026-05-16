export type TranslationSupplier =
  | "wish"
  | "cat"
  | "money"
  | "boom"
  | "boom_p4"
  | "yoshida"
  | "mitago"
  | "apple";

export type ExtractReturn<T> = {
  value?: T;
  index: number;
};

export type TranslationParseResult = {
  supplier: string;
  name?: string;
  price?: number;
  cost?: number;
  option?: string[][];
  dueDate?: string;
  description?: string;
};

type Strategy = {
  getSupplier(): string;
  extractProductName(data: string[]): ExtractReturn<string>;
  extractPrice(data: string[]): ExtractReturn<number>;
  extractCost(data: string[]): ExtractReturn<number>;
  extractOption(data: string[]): ExtractReturn<string[][]>;
  extractDueDate(data: string[]): ExtractReturn<Date>;
  extractDescription(data: string[]): ExtractReturn<string>;
};

export const TRANSLATION_SUPPLIERS: TranslationSupplier[] = [
  "wish",
  "cat",
  "money",
  "boom",
  "boom_p4",
  "yoshida",
  "mitago",
  "apple",
];

const DATE_PATTERN = String.raw`([0-9]{1,2}(?:[\/／-][0-9]{1,2}|月[0-9]{1,2}日?)|[0-9]{4})`;
const DEFAULT_STRATEGIES: Record<TranslationSupplier, () => Strategy> = {
  wish: () => new WishStrategy(),
  cat: () => new CatStrategy(),
  money: () => new MoneyStrategy(),
  boom: () => new BoomStrategy(),
  boom_p4: () => new BoomP4Strategy(),
  yoshida: () => new YoshidaStrategy(),
  mitago: () => new MitagoStrategy(),
  apple: () => new AppleStrategy(),
};

export function parseSupplierTranslationPost(
  supplier: TranslationSupplier,
  content: string,
): TranslationParseResult {
  return new ProductParser(DEFAULT_STRATEGIES[supplier]()).parse(content);
}

export function isTranslationSupplier(
  supplier: string,
): supplier is TranslationSupplier {
  return supplier in DEFAULT_STRATEGIES;
}

class ProductParser {
  constructor(private strategy: Strategy) {}

  parse(content: string): TranslationParseResult {
    const data = content.split("\n").map(line => line.trim());
    const dueDate = this.strategy.extractDueDate(data).value;

    return {
      supplier: this.strategy.getSupplier(),
      name: this.strategy.extractProductName(data).value,
      price: this.strategy.extractPrice(data).value,
      cost: this.strategy.extractCost(data).value,
      option: this.strategy.extractOption(data).value,
      dueDate: dueDate?.toISOString(),
      description: strictDescription(
        this.strategy.extractDescription(data).value ?? "",
      ),
    };
  }
}

function strictDescription(description: string): string {
  return description
    .split("\n")
    .map(line => line.trim())
    .filter(
      line =>
        !/批|原價|特價|優惠價|團購價|結單|現貨|到貨|到港|請勿|免運|中標|下單|留言|網址/.test(
          line,
        ),
    )
    .filter(line => !/[…⋯._=-➖]{4,}/.test(line))
    .map(line => (line === "." ? "\n" : line))
    .join("\n");
}

function extractFirstNumber(value: string): number | undefined {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function extractNumberFromLine(
  data: string[],
  predicate: (line: string) => boolean,
  fallback?: number,
): ExtractReturn<number> {
  const index = data.findIndex(predicate);
  if (index < 0) {
    return { index: -1 };
  }

  return {
    index,
    value: extractFirstNumber(data[index] ?? "") ?? fallback,
  };
}

export function parseBracketOptions(line: string): string[][] | undefined {
  const match = line.match(/[[［](.*)[\]］]/);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1]
    .split(/[/／]/)
    .map(group => group.split(/[,，]/).map(option => option.trim()))
    .filter(group => group.some(Boolean));
}

function extractBracketOptions(
  data: string[],
  optionRegex: RegExp,
): ExtractReturn<string[][]> {
  const index = data.findIndex(line => optionRegex.test(line));
  return {
    index,
    value: index > -1 ? parseBracketOptions(data[index] ?? "") : undefined,
  };
}

export function parseSlashOptions(value: string): string[][] {
  return value
    .split("@")
    .map(group => group.split(/[/／]/).map(option => option.trim()))
    .filter(group => group.some(Boolean));
}

function extractDueDateFromLine(
  data: string[],
  dueDateRegex: RegExp,
): ExtractReturn<Date> {
  const index = data.findIndex(line => dueDateRegex.test(line));
  if (index < 0) {
    return { index: -1, value: getDefaultDueDate() };
  }

  const match = data[index]?.match(dueDateRegex);
  return {
    index,
    value: getDueDate(parseDate(match?.[1])),
  };
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(
    /^([0-9]{1,2})(?:[/／-]([0-9]{1,2})|月([0-9]{1,2})日?)?$/,
  );
  if (!match) {
    return undefined;
  }

  const month = Number.parseInt(match[1] ?? "", 10);
  const day = Number.parseInt(match[2] ?? match[3] ?? "", 10);
  if (!month || !day || month > 12 || day > 31) {
    return undefined;
  }

  const expectedYear = getDefaultDueDate().getFullYear();
  return new Date(expectedYear, month - 1, day, 20, 0, 0, 0);
}

function getDueDate(date = getDefaultDueDate()): Date {
  const expected = getDefaultDueDate();
  if (date > expected) {
    return expected;
  }
  return date;
}

function getDefaultDueDate(offsetDay = 7): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDay);
  date.setHours(20, 0, 0, 0);
  return date;
}

function removeKnownBoomPrefixes(value?: string): string {
  return (value ?? "")
    .replace("🔥現貨在台🔥", "")
    .replace("🔥現貨在台！", "")
    .replace("🔥現貨！", "")
    .replace("🔥許願回購款🔥", "")
    .replace("🔥好物預購🔥", "")
    .replace("🔥好物預購！", "")
    .replace("🔥好物預購", "")
    .replace("好評許願回購！", "")
    .replace("💕許願款現貨抵台回購！", "");
}

function descriptionWithout(
  data: string[],
  regexes: RegExp[],
  extraReject?: (line: string) => boolean,
): ExtractReturn<string> {
  const value = data
    .filter(line => regexes.every(regex => !regex.test(line)))
    .filter(line => !extraReject?.(line))
    .map(line => line.trim())
    .join("\n");

  return { index: 0, value };
}

const WISH_NAME_REGEX = new RegExp(
  String.raw`^(${DATE_PATTERN})?(收單|結單|結團)?(~?預購)?(.*)[\s-]\d{2}A.*$`,
);
const WISH_PRICE_REGEX = /(?:建議|團購價|建議售價)：?\$?\d+/;
const WISH_COST_REGEX = /^(?:NT|\$)/;
const BRACKET_OPTION_REGEX = /(?=.*[[［])(?=.*[\]］]).*/;
const WISH_DUE_DATE_REGEX = new RegExp(String.raw`${DATE_PATTERN}(收單|結單|結團)`);

class WishStrategy implements Strategy {
  getSupplier(): string {
    return "wish";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(line => WISH_NAME_REGEX.test(line));
    return {
      index,
      value: index > -1 ? data[index]?.match(WISH_NAME_REGEX)?.[5]?.trim() : undefined,
    };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => WISH_PRICE_REGEX.test(line), -1);
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => WISH_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractBracketOptions(data, BRACKET_OPTION_REGEX);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, WISH_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    return descriptionWithout(data, [
      WISH_NAME_REGEX,
      WISH_PRICE_REGEX,
      WISH_COST_REGEX,
      BRACKET_OPTION_REGEX,
      WISH_DUE_DATE_REGEX,
    ]);
  }
}

const CAT_NAME_REGEX = /^\w{2,4}-\d{4,5}\s(.*)/;
const CAT_PRICE_REGEX = /特價\D*(\d+)/;
const CAT_COST_REGEX = /批.*(\d+)/;
const COMMON_DUE_DATE_REGEX = new RegExp(String.raw`\W*${DATE_PATTERN}.*收單\S*`);

class CatStrategy implements Strategy {
  getSupplier(): string {
    return "cat";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(line => CAT_NAME_REGEX.test(line));
    return {
      index,
      value: index > -1 ? data[index]?.match(CAT_NAME_REGEX)?.[1] : undefined,
    };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(
      data,
      line => CAT_PRICE_REGEX.test(line) && !line.startsWith("批"),
      -1,
    );
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => CAT_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractBracketOptions(data, BRACKET_OPTION_REGEX);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    return descriptionWithout(data, [
      CAT_NAME_REGEX,
      CAT_PRICE_REGEX,
      CAT_COST_REGEX,
      BRACKET_OPTION_REGEX,
      COMMON_DUE_DATE_REGEX,
    ]);
  }
}

const MONEY_NAME_REGEX = /^[〔【［[\]](.*)[\]］】〕]$/;
const MONEY_PRICE_REGEX = /(售價|團購價|NT|💰|特價)+\D*(\d+)/u;
const MONEY_COST_REGEX = /^\$(\d+)/;
const PAREN_OPTION_REGEX = /.*[(（](.*[/／].*)[）)].*/;
const SEPARATOR_REGEX = /[…⋯._]{4,}/;

class MoneyStrategy implements Strategy {
  getSupplier(): string {
    return "money";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(line => MONEY_NAME_REGEX.test(line));
    return {
      index,
      value: index > -1 ? data[index]?.match(MONEY_NAME_REGEX)?.[1] : undefined,
    };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => MONEY_PRICE_REGEX.test(line), -1);
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => MONEY_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractParenthesizedOptions(data);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    const separatorIndex = data.findIndex(line => SEPARATOR_REGEX.test(line));
    const descriptionData = separatorIndex > -1 ? data.slice(separatorIndex + 1) : data;
    return descriptionWithout(descriptionData, [
      MONEY_NAME_REGEX,
      MONEY_PRICE_REGEX,
      MONEY_COST_REGEX,
      PAREN_OPTION_REGEX,
      COMMON_DUE_DATE_REGEX,
    ]);
  }
}

const BOOM_NAME_REGEX = /^\d+\s?\w*/;
const BOOM_PRICE_REGEX = /\$(\d+)/;
const BOOM_COST_REGEX = /^批(\d+)/;

class BoomStrategy implements Strategy {
  getSupplier(): string {
    return "boom";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(line => BOOM_NAME_REGEX.test(line));
    const resolvedIndex = index > -1 ? index : 0;
    return {
      index: resolvedIndex,
      value: removeKnownBoomPrefixes(data[resolvedIndex]),
    };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(
      data,
      line => BOOM_PRICE_REGEX.test(line) && !line.startsWith("批"),
      0,
    );
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => BOOM_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractBracketOptions(data, BRACKET_OPTION_REGEX);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    return descriptionWithout(data, [
      BOOM_NAME_REGEX,
      BOOM_PRICE_REGEX,
      BOOM_COST_REGEX,
      BRACKET_OPTION_REGEX,
      COMMON_DUE_DATE_REGEX,
    ]);
  }
}

class BoomP4Strategy extends BoomStrategy {
  extractCost(data: string[]): ExtractReturn<number> {
    const ret = extractNumberFromLine(data, line => BOOM_COST_REGEX.test(line), -1);
    if (!ret.value) {
      return ret;
    }
    ret.value = ret.value <= 350 ? ret.value + 20 : ret.value <= 500 ? ret.value + 30 : ret.value + 50;
    return ret;
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    const ret = this.extractCost(data);
    if (!ret.value) {
      return ret;
    }
    ret.value = ret.value <= 350 ? ret.value + 80 : ret.value <= 500 ? ret.value + 90 : ret.value + 100;
    return ret;
  }
}

const YOSHIDA_COST_REGEX = /^NT/;

class YoshidaStrategy implements Strategy {
  getSupplier(): string {
    return "yoshida";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    return { index: 0, value: data[0]?.replace("現貨~", "") };
  }

  extractPrice(): ExtractReturn<number> {
    return { index: -1, value: 0 };
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => YOSHIDA_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractBracketOptions(data, BRACKET_OPTION_REGEX);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    return descriptionWithout(data.slice(1), [
      YOSHIDA_COST_REGEX,
      BRACKET_OPTION_REGEX,
      COMMON_DUE_DATE_REGEX,
    ]);
  }
}

const MITAGO_NAME_REGEX = /[【［[\]](.*)[\]］】]/;
const MITAGO_PRICE_REGEX = /(?:優惠價|團購價|促銷價)\D*(\d+)[-~](\d+)元?/;
const MITAGO_COST_REGEX = /^批.*(\d+)/;

class MitagoStrategy implements Strategy {
  getSupplier(): string {
    return "mitago";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(line => MITAGO_NAME_REGEX.test(line));
    const value = index > -1 ? data[index]?.match(MITAGO_NAME_REGEX)?.[1] : data[0];
    return { index: index > -1 ? index : 0, value: removeKnownBoomPrefixes(value) };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(
      data,
      line => MITAGO_PRICE_REGEX.test(line) && !line.startsWith("批"),
      0,
    );
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => MITAGO_COST_REGEX.test(line), -1);
  }

  extractOption(data: string[]): ExtractReturn<string[][]> {
    return extractParenthesizedOptions(data);
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    return descriptionWithout(
      data,
      [
        MITAGO_NAME_REGEX,
        MITAGO_PRICE_REGEX,
        MITAGO_COST_REGEX,
        PAREN_OPTION_REGEX,
        COMMON_DUE_DATE_REGEX,
      ],
      line => line.includes("https://www.mammyup.com/"),
    );
  }
}

const APPLE_NAME_REGEX = /[〔【［[\]](.*)[\]］】〕]/;
const APPLE_PRICE_REGEX = /\$(\d+)/;
const APPLE_COST_REGEX = /P(\d+)/;
const APPLE_DIVIDER_REGEX = /(\.|…){6,}/;

class AppleStrategy implements Strategy {
  getSupplier(): string {
    return "apple";
  }

  extractProductName(data: string[]): ExtractReturn<string> {
    const index = data.findIndex(
      line => APPLE_NAME_REGEX.test(line) && !line.includes("下單連結"),
    );
    return {
      index,
      value: index > -1 ? data[index]?.match(APPLE_NAME_REGEX)?.[1] : undefined,
    };
  }

  extractPrice(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => APPLE_PRICE_REGEX.test(line), -1);
  }

  extractCost(data: string[]): ExtractReturn<number> {
    return extractNumberFromLine(data, line => APPLE_COST_REGEX.test(line), -1);
  }

  extractOption(): ExtractReturn<string[][]> {
    return { index: -1 };
  }

  extractDueDate(data: string[]): ExtractReturn<Date> {
    return extractDueDateFromLine(data, COMMON_DUE_DATE_REGEX);
  }

  extractDescription(data: string[]): ExtractReturn<string> {
    const firstDividerIndex = data.findIndex(row => APPLE_DIVIDER_REGEX.test(row));
    let lastDividerIndex = -1;
    for (let index = data.length - 1; index >= 0; index -= 1) {
      if (APPLE_DIVIDER_REGEX.test(data[index] ?? "")) {
        lastDividerIndex = index;
        break;
      }
    }
    const nameIndex = data.findIndex(row => APPLE_NAME_REGEX.test(row));
    const topDividerIndex = firstDividerIndex < nameIndex ? firstDividerIndex : -1;
    const bottomDividerIndex = lastDividerIndex > nameIndex ? lastDividerIndex : data.length;

    return descriptionWithout(
      data.slice(topDividerIndex + 1, bottomDividerIndex),
      [APPLE_NAME_REGEX, APPLE_PRICE_REGEX, APPLE_COST_REGEX, COMMON_DUE_DATE_REGEX],
      line => /珍惜製圖文|日本連線/.test(line),
    );
  }
}

function extractParenthesizedOptions(data: string[]): ExtractReturn<string[][]> {
  const index = data.findIndex(line => PAREN_OPTION_REGEX.test(line));
  const match = index > -1 ? data[index]?.match(PAREN_OPTION_REGEX) : undefined;
  return {
    index,
    value: match?.[1] ? parseSlashOptions(match[1]) : undefined,
  };
}
