import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  BadgeCheck,
  ClipboardSignature,
  Handshake,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type {
  ServiceType,
  Ticket,
  ServiceCategory,
  ServiceItem,
} from "@shared/api";

const WOREDA_OPTIONS = [
  "Woreda 1",
  "Woreda 2",
  "Woreda 3",
  "Woreda 4",
  "Woreda 5",
  "Woreda 6",
  "Woreda 7",
  "Woreda 8",
  "Woreda 9",
  "Woreda 10",
  "Woreda 11",
  "Woreda 12",
  "Woreda 13",
] as const;

const RECEPTION_GAINS = [
  {
    icon: BadgeCheck,
    title: "Eligibility checkpoint",
    description:
      "Quick guidance prompts reception to confirm the right paperwork before generating the QR ticket.",
  },
  {
    icon: ShieldCheck,
    title: "No personal data stored",
    description:
      "Tickets are tied to QR IDs, not phone numbers. Privacy policies stay intact across every interaction.",
  },
  {
    icon: Handshake,
    title: "Seamless hand-offs",
    description:
      "Window staff receive context automatically, including service type, notes, and priority markers.",
  },
];

const SCRIPT_POINTS = [
  "Welcome and verify service eligibility",
  "Capture service selection & add context",
  "Generate QR ticket and confirm lounge instructions",
];

type CreateTicketPayload = {
  service: ServiceType;
  ownerName: string;
  woreda: string;
  serviceCategory?: string;
  selectedServices?: string[];
};

import { apiFetch } from "@/lib/api";

async function createTicketRequest(
  payload: CreateTicketPayload,
): Promise<Ticket> {
  const body = {
    service: payload.service,
    ownerName: payload.ownerName,
    woreda: payload.woreda,
    serviceCategory: payload.serviceCategory,
    selectedServices: payload.selectedServices,
  };
  return apiFetch<Ticket>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

type DraftDetails = {
  ownerName: string;
  woreda: string;
  service: ServiceType;
  serviceCategory?: string;
  selectedServices?: string[];
  selectedServiceNames?: string[];
};

interface TicketPreviewProps {
  ticket: Ticket | null;
  details: DraftDetails;
  selectedServiceLabel: string;
  isGenerating: boolean;
}

function TicketPreview({
  ticket,
  details,
  selectedServiceLabel,
  isGenerating,
}: TicketPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let timer: number | undefined;
    if (!ticket) {
      setQrDataUrl(null);
      return () => {
        isActive = false;
        if (timer) window.clearInterval(timer);
      };
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const makeQr = () => {
      const statusUrl = `${origin}/tickets/${encodeURIComponent(ticket.code)}`;
      QRCode.toDataURL(statusUrl, { width: 240, margin: 1 })
        .then((url) => {
          if (isActive) setQrDataUrl(url);
        })
        .catch(() => {
          if (isActive) setQrDataUrl(null);
        });
    };

    // generate immediately and then refresh every 60s as indicated in UI
    makeQr();
    timer = window.setInterval(() => makeQr(), 60000);

    return () => {
      isActive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [ticket?.code]);

  const display = ticket
    ? {
        code: ticket.code,
        ownerName: ticket.ownerName ?? details.ownerName,
        woreda: ticket.woreda ?? details.woreda,
        selectedServiceNames: details.selectedServiceNames,
      }
    : {
        code: "Auto-assigned",
        ownerName: details.ownerName,
        woreda: details.woreda,
        selectedServiceNames: details.selectedServiceNames,
      };

  const trackingUrl = ticket
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/tickets/${ticket.code}`
    : null;
  const noteLines: string[] = [];

  return (
    <div className="rounded-lg sm:rounded-2xl border border-primary/40 bg-primary/10 p-3 sm:p-4 md:p-5 text-sm sm:text-base text-primary">
      <p className="font-semibold text-xs sm:text-sm uppercase tracking-wide">
        Ticket preview
      </p>
      {!ticket && (
        <p className="mt-2 text-primary/80 text-sm">
          Fill out the form to automatically issue the next order number and
          generate a QR ticket.
        </p>
      )}
      <div className="mt-4 grid gap-2 sm:gap-3 text-primary/80 text-sm">
        <p>
          <span className="font-semibold text-primary">Order number:</span>{" "}
          <span className="font-mono text-base sm:text-lg font-bold text-primary">
            {display.code}
          </span>
        </p>
        {display.ownerName && (
          <p>
            <span className="font-semibold text-primary">Property owner:</span>{" "}
            <span className="text-primary/90">{display.ownerName}</span>
          </p>
        )}
        {display.woreda && (
          <p>
            <span className="font-semibold text-primary">Woreda:</span>{" "}
            <span className="text-primary/90">{display.woreda}</span>
          </p>
        )}
        <p>
          <span className="font-semibold text-primary">Service:</span>{" "}
          <span className="text-primary/90">{selectedServiceLabel}</span>
        </p>
        {display.selectedServiceNames &&
          display.selectedServiceNames.length > 0 && (
            <div>
              <p className="font-semibold text-primary mb-1">
                Selected Services:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-primary/90 text-sm">
                {display.selectedServiceNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        {noteLines.length > 0 && (
          <div>
            <p className="font-semibold text-primary mb-1">Notes:</p>
            <ul className="ml-4 list-disc space-y-1 text-primary/90">
              {noteLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {ticket && trackingUrl && (
          <div className="space-y-2 pt-2 border-t border-primary/20">
            <p className="font-semibold text-primary text-xs sm:text-sm">
              Tracking URL:
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <a
                href={trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-xs sm:text-sm text-primary/90 underline hover:text-primary flex-1 sm:flex-initial"
              >
                {trackingUrl}
              </a>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(trackingUrl);
                    toast.success("Tracking URL copied to clipboard");
                  } catch {
                    try {
                      const tmp = document.createElement("textarea");
                      tmp.value = trackingUrl || "";
                      document.body.appendChild(tmp);
                      tmp.select();
                      document.execCommand("copy");
                      document.body.removeChild(tmp);
                      toast.success("Tracking URL copied to clipboard");
                    } catch {
                      toast.error("Unable to copy URL");
                    }
                  }
                }}
                className="shrink-0 rounded bg-primary/10 px-3 sm:px-2 py-2 sm:py-1 text-xs font-medium hover:bg-primary/20 transition-colors active:bg-primary/30"
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {ticket ? (
          <div className="mt-3 grid place-items-start">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ticket ${ticket.code}`}
                className="h-32 sm:h-40 md:h-48 w-32 sm:w-40 md:w-48 rounded-lg bg-white p-2 shadow-inner shadow-primary/30"
              />
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs sm:text-sm">
                  Generating QR preview…
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg sm:rounded-xl border border-primary/30 bg-white/70 p-3 text-primary/90">
            <p className="text-xs sm:text-sm">
              QR code appears here once you generate the ticket. Reception can
              print or show it on-screen instantly.
            </p>
          </div>
        )}
        {isGenerating && !ticket && (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating QR ticket…</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Reception() {
  const [ownerName, setOwnerName] = useState("");
  const [woreda, setWoreda] = useState("");
  const [service, setService] = useState<ServiceType>("");
  const [generatedTicket, setGeneratedTicket] = useState<Ticket | null>(null);
  const [lastSubmission, setLastSubmission] = useState<DraftDetails | null>(
    null,
  );
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(
    [],
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categoryServices, setCategoryServices] = useState<ServiceItem[]>([]);
  const [loadingCategoryServices, setLoadingCategoryServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(),
  );

  // Fetch service categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/service-categories", {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to load categories");
        }
        const data = await response.json();
        setServiceCategories(data.categories || []);
      } catch (error) {
        console.error("Failed to load service categories", error);
      }
    };

    fetchCategories();
  }, []);

  // Fetch services for selected category
  useEffect(() => {
    if (!selectedCategory) {
      setCategoryServices([]);
      setSelectedServices(new Set());
      return;
    }

    const fetchCategoryServices = async () => {
      setLoadingCategoryServices(true);
      try {
        const response = await fetch(
          `/api/service-categories/${selectedCategory}/services`,
          {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
            },
          },
        );
        if (!response.ok) {
          throw new Error("Failed to load services");
        }
        const data = await response.json();
        setCategoryServices(data.services || []);
      } catch (error) {
        console.error("Failed to load category services", error);
        setCategoryServices([]);
      } finally {
        setLoadingCategoryServices(false);
      }
    };

    fetchCategoryServices();
  }, [selectedCategory]);

  const selectedServiceLabel = useMemo(() => {
    const categoryId = generatedTicket?.serviceCategory ?? selectedCategory;
    const category = serviceCategories.find((cat) => cat.id === categoryId);
    return category?.name ?? "Not specified";
  }, [generatedTicket?.serviceCategory, selectedCategory, serviceCategories]);

  const selectedServiceNames = useMemo(() => {
    return Array.from(selectedServices)
      .map((id) => categoryServices.find((s) => s.id === id)?.name)
      .filter(Boolean) as string[];
  }, [selectedServices, categoryServices]);

  const createTicket = useMutation<Ticket, Error, CreateTicketPayload>({
    mutationFn: createTicketRequest,
    onSuccess: (ticket, variables) => {
      setGeneratedTicket(ticket);
      setLastSubmission({
        ownerName: variables.ownerName,
        woreda: variables.woreda,
        service: variables.service,
        serviceCategory: variables.serviceCategory,
        selectedServices: variables.selectedServices,
        selectedServiceNames,
      });
      toast.success(`Ticket ${ticket.code} generated`);
      setOwnerName("");
      setWoreda("");
      setSelectedCategory("");
      setSelectedServices(new Set());
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Unable to create ticket.";
      toast.error(message);
    },
  });

  const isFormValid = ownerName.trim().length > 0 && woreda.length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || createTicket.isPending) return;

    // Get the service code from the selected category
    const selectedCategoryObj = serviceCategories.find(
      (cat) => cat.id === selectedCategory,
    );
    const serviceCode = selectedCategoryObj?.code || "rights-group"; // Default service

    createTicket.mutate({
      service: serviceCode,
      ownerName: ownerName.trim(),
      woreda,
      serviceCategory: serviceCode, // Use the code, not the ID, for proper window routing
      selectedServices: Array.from(selectedServices),
    });
  };

  const handleServiceCheckboxChange = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  // Get the category code for draft
  const draftCategoryCode = serviceCategories.find(
    (cat) => cat.id === selectedCategory,
  )?.code;

  const draft: DraftDetails = {
    ownerName,
    woreda,
    service,
    serviceCategory: draftCategoryCode,
    selectedServices: Array.from(selectedServices),
    selectedServiceNames,
  };
  const previewDetails =
    generatedTicket && lastSubmission ? lastSubmission : draft;

  return (
    <ConsoleShell title="Reception Console" className="lg:grid-cols-1">
      <section className="w-full grid gap-8 sm:gap-12 py-4 sm:py-6">
        <Card className="w-full border-border/60 bg-card/90 p-4 sm:p-6 md:p-8 shadow-2xl">
          <CardHeader className="space-y-2 mb-6">
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <ClipboardSignature className="h-5 sm:h-6 w-5 sm:w-6 text-primary flex-shrink-0" />
              <span>Issue virtual ticket</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Name and Woreda fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="owner-name" className="text-sm font-medium">
                    Property owner's full name
                  </Label>
                  <Input
                    id="owner-name"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Add guest or organization name"
                    required
                    className="h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="woreda" className="text-sm font-medium">
                    Woreda
                  </Label>
                  <Select value={woreda} onValueChange={setWoreda}>
                    <SelectTrigger id="woreda" className="h-10">
                      <SelectValue placeholder="Select woreda" />
                    </SelectTrigger>
                    <SelectContent>
                      {WOREDA_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Service Category section */}
              {serviceCategories.length > 0 && (
                <div className="space-y-3 border-t border-border/40 pt-6">
                  <Label className="text-sm font-medium">
                    Service Category
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger id="category" className="h-10">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Services section */}
              {selectedCategory && (
                <div className="space-y-3 border-t border-border/40 pt-6">
                  <Label className="text-sm font-medium">Select Services</Label>
                  {loadingCategoryServices ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading services…</span>
                    </div>
                  ) : categoryServices.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No services available for this category.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border border-border/40 rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {categoryServices.map((svc) => (
                          <div key={svc.id} className="flex items-start gap-3">
                            <Checkbox
                              id={svc.id}
                              checked={selectedServices.has(svc.id)}
                              onCheckedChange={() =>
                                handleServiceCheckboxChange(svc.id)
                              }
                              className="mt-1"
                            />
                            <Label
                              htmlFor={svc.id}
                              className="font-normal cursor-pointer"
                            >
                              {svc.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ticket preview */}
              <TicketPreview
                ticket={generatedTicket}
                details={previewDetails}
                selectedServiceLabel={selectedServiceLabel}
                isGenerating={createTicket.isPending}
              />

              {/* Submit button */}
              <Button
                type="submit"
                className="h-11 sm:h-12 w-full text-sm sm:text-base shadow-lg shadow-primary/20"
                disabled={!isFormValid || createTicket.isPending}
              >
                {createTicket.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating…</span>
                  </span>
                ) : (
                  "Generate QR Ticket"
                )}
              </Button>
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                QR auto-refreshes every 60 seconds. Print or display to the
                guest instantly.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="w-full border-t border-border/60 bg-foreground/5 py-8 sm:py-12 md:py-16 -mx-[1rem] sm:-mx-[1.5rem] lg:-mx-[2rem] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:gap-6 md:gap-8 lg:grid-cols-3">
          {RECEPTION_GAINS.map((item) => (
            <Card
              key={item.title}
              className="border-border/60 bg-card/80 p-4 sm:p-6 shadow-md shadow-primary/5 hover:bg-card/90 transition-colors"
            >
              <CardHeader className="space-y-3 mb-4">
                <div className="inline-flex h-10 sm:h-12 w-10 sm:w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary flex-shrink-0">
                  <item.icon className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </ConsoleShell>
  );
}
