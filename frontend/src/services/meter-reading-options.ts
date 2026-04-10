export interface CatalogOption {
  label: string;
  value: string;
}

type ProtocolFamily = "dlms" | "dlt645" | "generic" | "protocol-2.2";

export type MeterReadingChoiceKey =
  | "units"
  | "balance"
  | "voltage"
  | "current"
  | "maximum-demand"
  | "power"
  | "relay-status"
  | "last-hour-usage";

export interface MeterReadingChoice {
  key: MeterReadingChoiceKey;
  label: string;
  value: string;
  helpText: string;
  source: "catalog" | "fallback";
}

interface MeterReadingDefinition {
  key: MeterReadingChoiceKey;
  label: string;
  aliases: string[];
  helpText: string;
  fallbackValues?: Partial<Record<ProtocolFamily, string>>;
}

export const DEFAULT_METER_READING_CHOICE_KEY: MeterReadingChoiceKey = "units";
export const CUSTOM_METER_READING_CHOICE_KEY = "__custom__";

const meterReadingDefinitions: MeterReadingDefinition[] = [
  {
    key: "units",
    label: "Units",
    aliases: [
      "forward active energy",
      "active energy",
      "total energy",
      "total units",
      "units",
      "kwh",
    ],
    helpText: "Reads the main meter units or total energy.",
    fallbackValues: {
      dlms: "1.0.1.8.0.255",
      dlt645: "00010000",
      "protocol-2.2": "Units",
      generic: "1.0.1.8.0.255",
    },
  },
  {
    key: "balance",
    label: "Balance",
    aliases: ["credit balance", "remaining balance", "balance", "credit"],
    helpText: "Reads the remaining credit or balance when the meter supports it.",
    fallbackValues: {
      "protocol-2.2": "Balance",
    },
  },
  {
    key: "voltage",
    label: "Voltage",
    aliases: ["voltage reading", "voltage", "phase voltage"],
    helpText: "Reads the live meter voltage.",
    fallbackValues: {
      dlms: "1.0.32.7.0.255",
      "protocol-2.2": "Voltage",
    },
  },
  {
    key: "current",
    label: "Current",
    aliases: ["current reading", "current", "phase current"],
    helpText: "Reads the live meter current.",
    fallbackValues: {
      dlms: "1.0.31.7.0.255",
      "protocol-2.2": "Current",
    },
  },
  {
    key: "maximum-demand",
    label: "Maximum Demand",
    aliases: ["maximum demand", "max demand", "demand max", "maximum power"],
    helpText: "Reads the highest demand value recorded by the meter.",
  },
  {
    key: "power",
    label: "Power",
    aliases: ["active power", "instantaneous power", "power value", "power"],
    helpText: "Reads the live power value.",
    fallbackValues: {
      dlms: "1.0.16.7.0.255",
      "protocol-2.2": "Power",
    },
  },
  {
    key: "relay-status",
    label: "Relay Status",
    aliases: ["relay status", "switch status", "relay state", "relay"],
    helpText: "Checks whether the meter relay is open or closed.",
    fallbackValues: {
      "protocol-2.2": "Relay Status",
    },
  },
  {
    key: "last-hour-usage",
    label: "Last Hour Usage",
    aliases: ["last hour usage", "hourly usage", "hour usage", "last usage"],
    helpText: "Reads the most recent hourly usage value.",
  },
];

function getProtocolFamily(protocolVersion: unknown): ProtocolFamily {
  const value = typeof protocolVersion === "string" ? protocolVersion.toLowerCase().trim() : "";
  if (/(^|[^0-9])2\.2([^0-9]|$)/.test(value)) {
    return "protocol-2.2";
  }

  if (value.includes("dlms")) {
    return "dlms";
  }

  if (value.includes("645")) {
    return "dlt645";
  }

  return "generic";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCatalogMatch(
  definition: MeterReadingDefinition,
  catalogOptions: CatalogOption[],
  usedValues: Set<string>,
) {
  for (const option of catalogOptions) {
    if (usedValues.has(option.value)) {
      continue;
    }

    const normalized = normalizeText(option.label);
    const hasMatch = definition.aliases.some((alias) => normalized.includes(normalizeText(alias)));
    if (hasMatch) {
      return option;
    }
  }

  return null;
}

export function buildMeterReadingChoices(
  catalogOptions: CatalogOption[],
  protocolVersion: unknown,
): MeterReadingChoice[] {
  const protocolFamily = getProtocolFamily(protocolVersion);
  const usedValues = new Set<string>();
  const choices: MeterReadingChoice[] = [];

  for (const definition of meterReadingDefinitions) {
    const catalogMatch = findCatalogMatch(definition, catalogOptions, usedValues);
    if (catalogMatch) {
      usedValues.add(catalogMatch.value);
      choices.push({
        key: definition.key,
        label: definition.label,
        value: catalogMatch.value,
        helpText: definition.helpText,
        source: "catalog",
      });
      continue;
    }

    const fallbackValue =
      definition.fallbackValues?.[protocolFamily] ??
      definition.fallbackValues?.generic ??
      null;

    if (!fallbackValue || usedValues.has(fallbackValue)) {
      continue;
    }

    usedValues.add(fallbackValue);
    choices.push({
      key: definition.key,
      label: definition.label,
      value: fallbackValue,
      helpText: definition.helpText,
      source: "fallback",
    });
  }

  return choices;
}

export function resolveDefaultMeterReadingChoice(choices: MeterReadingChoice[]) {
  return choices.find((choice) => choice.key === DEFAULT_METER_READING_CHOICE_KEY) ?? choices[0] ?? null;
}
