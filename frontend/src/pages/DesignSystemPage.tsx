import {
  Badge,
  Button,
  Cluster,
  DataTable,
  Divider,
  EmptyState,
  Field,
  Input,
  MetricCard,
  PageHeader,
  SectionHeader,
  Select,
  Stack,
  Surface,
  Text,
  Textarea,
} from "../components/ui/system";

const colorTokens = [
  { name: "Surface 0", value: "var(--surface-0)" },
  { name: "Surface 1", value: "var(--surface-1)" },
  { name: "Surface 2", value: "var(--surface-2)" },
  { name: "Surface 3", value: "var(--surface-3)" },
  { name: "Success", value: "var(--success)" },
  { name: "Info", value: "var(--info)" },
  { name: "Warning", value: "var(--warning)" },
  { name: "Danger", value: "var(--danger)" },
];

const spacingTokens = [
  "--space-2xs",
  "--space-xs",
  "--space-sm",
  "--space-md",
  "--space-lg",
  "--space-xl",
  "--space-2xl",
  "--space-3xl",
];

const previewRows = [
  { site: "UMAISHA", status: "Healthy", meters: 42, revenue: "₦1.8M" },
  { site: "MUSHA", status: "Monitoring", meters: 37, revenue: "₦1.4M" },
  { site: "KYAKALE", status: "Healthy", meters: 31, revenue: "₦1.2M" },
];

export function DesignSystemPage() {
  return (
    <div className="ds-design-system-page ds-animate-fade-in">
      <PageHeader
        eyebrow="System Foundations"
        title="ACOB Odyssey Design System"
        description="A living reference for tokens, shared surfaces, typography, forms, and data display. New screens should compose from these primitives before introducing page-only styling."
        actions={
          <>
            <Button icon={<GridIcon />} variant="primary">
              Shared primitives
            </Button>
            <Button icon={<TableIcon />} variant="secondary">
              Table-ready
            </Button>
          </>
        }
      />

      <div className="ds-layout-grid ds-layout-grid--split">
        <Surface>
          <SectionHeader
            title="Core principles"
            description="The product UI stays operational and calm: fewer wrapper styles, tighter state language, and stronger reuse."
          />
          <div className="ds-layout-grid ds-layout-grid--two" style={{ marginTop: "var(--space-lg)" }}>
            <MetricCard icon={<LayersIcon />} label="Surface hierarchy" meta="From shell background to elevated panels." tone="neutral" value="4 levels" />
            <MetricCard icon={<AccentIcon />} label="Primary accent" meta="Reserved for action, success, and focus." tone="accent" value="Green" />
            <MetricCard icon={<ChartIcon />} label="Data-first layout" meta="Tables, filters, and metrics stay readable without feeling loud." tone="info" value="Readable" />
          </div>
        </Surface>

        <Surface tone="accent">
          <Stack space="md">
            <Badge tone="accent">Usage</Badge>
            <Text as="h2" variant="section">
              Where the system applies
            </Text>
            <Text>
              Shared page headers, tables, form controls, modal shells, and panel surfaces now resolve through one token set and one primitive layer.
            </Text>
            <Cluster>
              <Badge>Layout</Badge>
              <Badge>Forms</Badge>
              <Badge>Cards</Badge>
              <Badge>Tables</Badge>
            </Cluster>
          </Stack>
        </Surface>
      </div>

      <div className="ds-layout-grid ds-layout-grid--two">
        <Surface>
          <SectionHeader
            title="Color tokens"
            description="Surfaces stay dark and restrained so actions and states are the only strong signals."
          />
          <div className="ds-token-grid" style={{ marginTop: "var(--space-lg)" }}>
            {colorTokens.map((token) => (
              <div className="ds-token-card" key={token.name}>
                <div className="ds-token-card__chip" style={{ background: token.value }} />
                <Text as="div" variant="label">
                  {token.name}
                </Text>
                <Text variant="caption">{token.value}</Text>
              </div>
            ))}
          </div>
        </Surface>

        <Surface>
          <SectionHeader
            title="Typography and spacing"
            description="Display type is for structure. Utility copy stays compact, plain, and operational."
          />
          <Stack className="ds-demo-actions" space="lg">
            <div>
              <Text variant="eyebrow">Eyebrow</Text>
              <Text as="h2" style={{ marginTop: "var(--space-xs)" }} variant="title">
                Section-led hierarchy
              </Text>
              <Text style={{ marginTop: "var(--space-xs)" }}>
                Primary pages should open with one strong headline, one short orientation line, and then move directly into working surfaces.
              </Text>
            </div>
            <Divider />
            <Stack space="sm">
              {spacingTokens.map((token) => (
                <div className="ds-spacing-preview" key={token}>
                  <Text variant="mono">{token}</Text>
                  <div className="ds-spacing-preview__bar" style={{ width: `var(${token})` }} />
                </div>
              ))}
            </Stack>
          </Stack>
        </Surface>
      </div>

      <div className="ds-layout-grid ds-layout-grid--two">
        <Surface>
          <SectionHeader
            title="Surfaces, cards, and actions"
            description="Most new UI should vary tone and density, not invent wrapper styles."
          />
          <div className="ds-layout-grid ds-layout-grid--two" style={{ marginTop: "var(--space-lg)" }}>
            <MetricCard icon={<ChartIcon />} label="Portfolio revenue" meta="Updated 12 minutes ago" tone="accent" value="₦5.2M" />
            <MetricCard icon={<WarningIcon />} label="Flagged alarms" meta="2 require operator acknowledgement" tone="warning" value="08" />
          </div>
          <Cluster className="ds-demo-actions">
            <Button icon={<ArrowIcon />} variant="primary">
              Primary action
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Destructive</Button>
          </Cluster>
        </Surface>

        <Surface>
          <SectionHeader
            title="Form language"
            description="Fields use one label style, one border treatment, and one focus ring."
          />
          <Stack className="ds-demo-actions" space="md">
            <Field hint="Use selects for constrained operational choices." label="Site selection">
              <Select defaultValue="ALL">
                <option value="ALL">All sites</option>
                <option value="UMAISHA">UMAISHA</option>
                <option value="MUSHA">MUSHA</option>
              </Select>
            </Field>
            <Field hint="Numeric filters should use the compact field treatment." label="Threshold amount" required>
              <Input placeholder="500" type="number" />
            </Field>
            <Field label="Operator note">
              <Textarea placeholder="Add implementation notes or review context..." />
            </Field>
          </Stack>
        </Surface>
      </div>

      <DataTable
        columns={[
          { id: "site", header: "Site", cell: (row) => row.site },
          { id: "status", header: "Status", cell: (row) => <Badge tone={row.status === "Healthy" ? "accent" : "warning"}>{row.status}</Badge> },
          { id: "meters", header: "Meters", cell: (row) => row.meters, align: "right" },
          { id: "revenue", header: "Revenue", cell: (row) => row.revenue, align: "right" },
        ]}
        footer={<Text variant="caption">This preview mirrors the compact table shell intended for new operational pages.</Text>}
        header={
          <SectionHeader
            action={<Badge tone="info">Shared table primitive</Badge>}
            description="Uppercase compact headers, soft row dividers, horizontal overflow support, and a shared footer area."
            title="Table specification"
          />
        }
        rows={previewRows}
      />

      <div className="ds-layout-grid ds-layout-grid--two">
        <Surface>
          <SectionHeader title="Empty states" description="Empty views should stay calm, centered, and action-oriented." />
          <EmptyState
            action={<Button variant="secondary">Adjust filters</Button>}
            description="Try widening the date range or removing one filter to reload this report."
            icon={<EmptyIcon />}
            title="No report rows"
          />
        </Surface>

        <Surface>
          <SectionHeader title="Tones" description="Surface tone should communicate context, not become page decoration." />
          <Stack className="ds-demo-actions" space="sm">
            <Surface padding="sm">
              <Text variant="caption">Default surface for primary panels and containers.</Text>
            </Surface>
            <Surface padding="sm" tone="muted">
              <Text variant="caption">Muted surface for quieter nested sections.</Text>
            </Surface>
            <Surface padding="sm" tone="danger">
              <Text variant="caption">Danger surface reserved for errors and destructive confirmation states.</Text>
            </Surface>
          </Stack>
        </Surface>
      </div>
    </div>
  );
}

function GridIcon() {
  return <svg fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M4 4h7v7H4Zm9 0h7v7h-7ZM4 13h7v7H4Zm9 0h7v7h-7Z" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

function TableIcon() {
  return <svg fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Zm0 4.5h16M10 11v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function LayersIcon() {
  return <svg fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="m12 3 8 4.5-8 4.5-8-4.5Zm8 7-8 4.5L4 10m16 4.5L12 19l-8-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function AccentIcon() {
  return <svg fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M12 3v18M7 8h7.5a3.5 3.5 0 0 1 0 7H9.5a3.5 3.5 0 0 0 0 7H17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function ChartIcon() {
  return <svg fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M4 19h16M7 15l3-3 3 2 4-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function WarningIcon() {
  return <svg fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M12 8v5m0 4h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function ArrowIcon() {
  return <svg fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function EmptyIcon() {
  return <svg fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Zm0 3.5h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
