import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  RegionAll,
  RegionApac,
  RegionEurope,
  RegionNorthAmerica,
  RegionSouthAfrica,
  RegionSouthAmerica,
} from "@/components/icon";
import { mapEntries } from "@/lib/maps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const regionOptions = [
  { value: "all", label: "All regions", icon: RegionAll },
  { value: "eu", label: "Europe", icon: RegionEurope },
  { value: "na", label: "North America", icon: RegionNorthAmerica },
  { value: "sa", label: "South America", icon: RegionSouthAmerica },
  { value: "za", label: "South Africa", icon: RegionSouthAfrica },
  { value: "apac", label: "Asia Pacific", icon: RegionApac },
];

const visibilityOptions = [
  { value: "all", label: "All servers" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

const gameModeOptions = [
  { value: "all", label: "All modes" },
  { value: "ca", label: "Clan Arena" },
  { value: "duel", label: "Duel" },
  { value: "ffa", label: "Free For All" },
  { value: "tdm", label: "Team Deathmatch" },
  { value: "ctf", label: "CTF" },
  { value: "ad", label: "Attack & Defend" },
  { value: "dom", label: "Domination" },
  { value: "ft", label: "Freeze Tag" },
  { value: "har", label: "Harvester" },
  { value: "race", label: "Race" },
  { value: "rr", label: "Red Rover" },
];

export const RATING_FILTER_MIN = 0;
export const RATING_FILTER_MAX = 3000;

export function createDefaultRatingRange(): [number, number] {
  return [RATING_FILTER_MIN, RATING_FILTER_MAX];
}

export type RatingSystem = "qelo" | "trueskill";

export type ServerFiltersValue = {
  search: string;
  region: string;
  visibility: "all" | "public" | "private";
  maps: string[];
  gameMode: string;
  ratingSystem: RatingSystem;
  ratingRange: [number, number];
  tags: string[];
  hideEmpty: boolean;
  hideFull: boolean;
};

export function createDefaultServerFilters(): ServerFiltersValue {
  return {
    search: "",
    region: "all",
    visibility: "all",
    maps: [],
    gameMode: "all",
    ratingSystem: "qelo",
    ratingRange: createDefaultRatingRange(),
    tags: [],
    hideEmpty: false,
    hideFull: false,
  };
}

export function ServerFilters({
  value,
  onChange,
  onReset,
  onRefresh,
  refreshing = false,
}: {
  value: ServerFiltersValue;
  onChange: (next: ServerFiltersValue) => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasActiveFilters =
    value.search.trim().length > 0 ||
    value.region !== "all" ||
    value.visibility !== "all" ||
    value.maps.length > 0 ||
    value.gameMode !== "all" ||
    value.ratingRange[0] !== RATING_FILTER_MIN ||
    value.ratingRange[1] !== RATING_FILTER_MAX ||
    value.tags.length > 0 ||
    value.hideEmpty ||
    value.hideFull;
  const selectedRegion =
    regionOptions.find((option) => option.value === value.region) ?? regionOptions[0];
  const SelectedRegionIcon = selectedRegion.icon;

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Filters</h2>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 gap-2"
            >
              {refreshing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed((current) => !current)}
                    className="size-8"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? "Expand filters" : "Collapse filters"}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {collapsed ? "Expand filters" : "Collapse filters"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="relative">
          <motion.div
            initial={false}
            animate={{ height: collapsed ? 96 : "auto" }}
            transition={{
              duration: 0.48,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-1 pt-1">
              <div className="grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={value.search}
                    onChange={(event) => onChange({ ...value, search: event.target.value })}
                    placeholder="Search server name"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.85fr)_minmax(0,0.9fr)]">
                  <TagFilter value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />

                  <Select
                    value={value.region}
                    onValueChange={(region) => onChange({ ...value, region })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Region">
                        <span className="flex items-center gap-2">
                          <SelectedRegionIcon className="size-4 shrink-0" />
                          <span>{selectedRegion.label}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {regionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <option.icon className="size-4 shrink-0" />
                          <span className="flex items-center gap-2">
                            <span>{option.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={value.visibility}
                    onValueChange={(visibility) =>
                      onChange({
                        ...value,
                        visibility: visibility as ServerFiltersValue["visibility"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={value.gameMode}
                    onValueChange={(gameMode) => onChange({ ...value, gameMode })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Game mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {gameModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3">
                  <MapMultiSelect
                    value={value.maps}
                    onChange={(maps) => onChange({ ...value, maps })}
                  />
                </div>

                <div className="grid gap-3">
                  <RatingRangeFilter
                    system={value.ratingSystem}
                    range={value.ratingRange}
                    onSystemChange={(ratingSystem) => onChange({ ...value, ratingSystem })}
                    onRangeChange={(ratingRange) => onChange({ ...value, ratingRange })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant={value.hideEmpty ? "default" : "outline"}
                    onClick={() => onChange({ ...value, hideEmpty: !value.hideEmpty })}
                    className="w-full"
                  >
                    Hide Empty
                  </Button>

                  <Button
                    variant={value.hideFull ? "default" : "outline"}
                    onClick={() => onChange({ ...value, hideFull: !value.hideFull })}
                    className="w-full"
                  >
                    Hide Full
                  </Button>
                </div>

                {hasActiveFilters ? (
                  <Button variant="ghost" onClick={onReset} className="w-full">
                    <X className="size-4" />
                    Clear all
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>

          <AnimatePresence initial={false}>
            {collapsed ? (
              <motion.div
                key="filters-fade"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent"
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function RatingRangeFilter({
  system,
  range,
  onSystemChange,
  onRangeChange,
}: {
  system: RatingSystem;
  range: [number, number];
  onSystemChange: (system: RatingSystem) => void;
  onRangeChange: (range: [number, number]) => void;
}) {
  const [draftRange, setDraftRange] = useState<[number, number]>(range);

  useEffect(() => {
    setDraftRange(range);
  }, [range]);

  useEffect(() => {
    if (draftRange[0] === range[0] && draftRange[1] === range[1]) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onRangeChange(draftRange);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [draftRange, onRangeChange, range]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Rating</div>
          <div className="text-xs text-muted-foreground">
            Filter servers by average QElo or TSkill.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-md">
            {draftRange[0]}
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            {draftRange[1]}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
        <Select value={system} onValueChange={(value) => onSystemChange(value as RatingSystem)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Rating system" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qelo">QElo</SelectItem>
            <SelectItem value="trueskill">TSkill</SelectItem>
          </SelectContent>
        </Select>

        <Slider
          min={RATING_FILTER_MIN}
          max={RATING_FILTER_MAX}
          step={25}
          value={draftRange}
          onValueChange={(next) => {
            if (next.length === 2) {
              setDraftRange([next[0], next[1]]);
            }
          }}
        />
      </div>
    </div>
  );
}

function MapMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (maps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedMaps = useMemo(
    () => mapEntries.filter((map) => value.includes(map.id)),
    [value],
  );

  const label =
    selectedMaps.length === 0
      ? "All maps"
      : selectedMaps.length === 1
        ? selectedMaps[0].name
        : `${selectedMaps.length} maps selected`;

  function toggleMap(mapId: string) {
    if (value.includes(mapId)) {
      onChange(value.filter((item) => item !== mapId));
      return;
    }

    onChange([...value, mapId]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          role="combobox"
          aria-expanded={open}
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search maps..." />
          <CommandList className="max-h-80">
            <CommandEmpty>No maps found.</CommandEmpty>
            <CommandGroup>
              {selectedMaps.length > 0 ? (
                <div className="flex flex-wrap gap-1 border-b border-border p-2">
                  {selectedMaps.map((map) => (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => toggleMap(map.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {map.name}
                      <X className="size-3" />
                    </button>
                  ))}
                </div>
              ) : null}

              {mapEntries.map((map) => {
                const checked = value.includes(map.id);

                return (
                  <CommandItem
                    key={map.id}
                    value={`${map.id} ${map.name}`}
                    onSelect={() => toggleMap(map.id)}
                    className="gap-3 px-3 py-2"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <img
                      src={map.image}
                      alt={map.name}
                      className="h-10 w-16 rounded object-cover"
                    />
                    <span className="flex-1 truncate">{map.name}</span>
                    {checked ? <Check className="size-4 text-primary" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  function addTag(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag || value.includes(tag)) {
      return;
    }
    onChange([...value, tag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  const label =
    value.length === 0 ? "Tags" : value.length === 1 ? value[0] : `${value.length}+ tags`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          role="combobox"
          aria-expanded={open}
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {value.length > 0 ? (
              value.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No tags selected.</span>
            )}
          </div>

          <div className="flex min-h-9 items-center rounded-md border border-input bg-transparent px-2">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && tagInput.length === 0 && value.length > 0) {
                  event.preventDefault();
                  removeTag(value[value.length - 1]);
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              onBlur={() => {
                if (tagInput.trim()) {
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              placeholder="Type tag and press Enter"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
