import { useState } from "react";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalQueuePanel } from "@/components/archiever/GlobalQueuePanel";
import { ActiveTicketWorkspace } from "@/components/archiever/ActiveTicketWorkspace";
import { MyActiveWorkIndicator } from "@/components/archiever/MyActiveWorkIndicator";
import { ArchivedTicketsHistory } from "@/components/archiever/ArchivedTicketsHistory";
import { Card } from "@/components/ui/card";

export default function Archiever() {
  const [selectedTicketId, setSelectedTicketId] = useState<
    string | undefined
  >();
  const [selectedTicketCode, setSelectedTicketCode] = useState<
    string | undefined
  >();
  const [activeTab, setActiveTab] = useState("queue");

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
    <ConsoleShell title="Archiver Interface">
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
