import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalQueuePanel } from "@/components/archiever/GlobalQueuePanel";
import { ActiveTicketWorkspace } from "@/components/archiever/ActiveTicketWorkspace";
import { MyActiveWorkIndicator } from "@/components/archiever/MyActiveWorkIndicator";
import { ArchivedTicketsHistory } from "@/components/archiever/ArchivedTicketsHistory";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import type { JobTitle } from "@shared/api";

export default function Archiever() {
  const { user } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useState<
    string | undefined
  >();
  const [selectedTicketCode, setSelectedTicketCode] = useState<
    string | undefined
  >();
  const [activeTab, setActiveTab] = useState("queue");
  const [headerTitle, setHeaderTitle] = useState("Archiver Interface");

  // Fetch job titles to get the name from jobTitleId
  const { data: jobTitles } = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/job-titles");
      if (!response.ok) throw new Error("Failed to fetch job titles");
      return response.json() as Promise<{ jobTitles: JobTitle[] }>;
    },
    enabled: !!user?.jobTitleId,
  });

  // Update header title when user or job titles change
  useEffect(() => {
    if (user?.fullName || user?.jobTitleId) {
      let title = "Archiver Interface";
      if (user.fullName) {
        title = user.fullName;
        if (user.jobTitleId && jobTitles) {
          const jobTitle = jobTitles.find((jt) => jt.id === user.jobTitleId);
          if (jobTitle) {
            const jobTitleName =
              jobTitle.nameEnglish || jobTitle.nameAmharic || "No Title";
            title = `${user.fullName} · ${jobTitleName}`;
          }
        }
      }
      setHeaderTitle(title);
    }
  }, [user, jobTitles]);

  const handleTicketSelected = (ticketId: string, ticketCode: string) => {
    setSelectedTicketId(ticketId);
    setSelectedTicketCode(ticketCode);
    setActiveTab("workspace");
  };

  const handleTicketRetrieved = () => {
    setSelectedTicketId(undefined);
    setSelectedTicketCode(undefined);
    setActiveTab("queue");
  };

  const handleReleaseTicket = () => {
    setSelectedTicketId(undefined);
    setSelectedTicketCode(undefined);
    setActiveTab("queue");
  };

  return (
    <ConsoleShell title={headerTitle}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main content area - 3 columns */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="queue">Global Queue</TabsTrigger>
              <TabsTrigger value="workspace" disabled={!selectedTicketId}>
                Working on Ticket
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="space-y-4">
              <GlobalQueuePanel
                onTicketSelected={handleTicketSelected}
                selectedTicketId={selectedTicketId}
              />
            </TabsContent>

            <TabsContent value="workspace">
              {selectedTicketId ? (
                <ActiveTicketWorkspace
                  ticketId={selectedTicketId}
                  onTicketRetrieved={handleTicketRetrieved}
                  onReleaseTicket={handleReleaseTicket}
                />
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Select a ticket from the Global Queue to begin
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history">
              <ArchivedTicketsHistory />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - 1 column */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <MyActiveWorkIndicator
              ticketCode={selectedTicketCode}
              startTime={selectedTicketId ? Date.now() : undefined}
              isWorkingOnTicket={!!selectedTicketId}
              onClear={() => {
                setSelectedTicketId(undefined);
                setSelectedTicketCode(undefined);
              }}
            />
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
