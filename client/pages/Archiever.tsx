import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GlobalQueuePanel } from "@/components/archiever/GlobalQueuePanel";
import { ActiveTicketWorkspace } from "@/components/archiever/ActiveTicketWorkspace";
import { MyActiveWorkIndicator } from "@/components/archiever/MyActiveWorkIndicator";
import { ArchivedTicketsHistory } from "@/components/archiever/ArchivedTicketsHistory";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { JobTitle } from "@shared/api";

export default function Archiever() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedTicketId, setSelectedTicketId] = useState<
    string | undefined
  >();
  const [selectedTicketCode, setSelectedTicketCode] = useState<
    string | undefined
  >();
  const [activeTab, setActiveTab] = useState("queue");
  const [headerTitle, setHeaderTitle] = useState("Archiver Interface");

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  // Fetch job titles to get the name from jobTitleId
  const { data: jobTitles } = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/job-titles");
      if (!response.ok) throw new Error("Failed to fetch job titles");
      const result = (await response.json()) as { jobTitles: JobTitle[] };
      return result.jobTitles;
    },
    enabled: !!user?.jobTitleId,
  });

  // Update header title when user or job titles change
  useEffect(() => {
    let title = "Archiver Interface";

    if (user?.fullName) {
      title = user.fullName;

      if (user.jobTitleId && jobTitles && jobTitles.length > 0) {
        const jobTitle = jobTitles.find((jt) => jt.id === user.jobTitleId);
        if (jobTitle) {
          const jobTitleName =
            jobTitle.nameAmharic || jobTitle.nameEnglish || "No Title";
          title = `${user.fullName} - ${jobTitleName}`;
        }
      }
    }

    setHeaderTitle(title);
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
    <ConsoleShell
      title={headerTitle}
      action={
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      }
    >
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
