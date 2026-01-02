import { useState } from "react";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalQueuePanel } from "@/components/archiever/GlobalQueuePanel";
import { ActiveTicketWorkspace } from "@/components/archiever/ActiveTicketWorkspace";
import { MyActiveWorkIndicator } from "@/components/archiever/MyActiveWorkIndicator";
import { ArchivedTicketsHistory } from "@/components/archiever/ArchivedTicketsHistory";
import { Card } from "@/components/ui/card";

export default function Archiever() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();
  const [selectedTicketCode, setSelectedTicketCode] = useState<string | undefined>();
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
    <ConsoleShell
      title="Archiver Interface"
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

      {/* Information Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">1️⃣ Global Queue</h3>
          <p className="text-blue-800">
            Browse all newly created tickets waiting for document retrieval. Click "Start" to claim a ticket.
          </p>
        </Card>

        <Card className="p-4 bg-purple-50 border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-2">2️⃣ Active Workspace</h3>
          <p className="text-purple-800">
            Work on claimed tickets. Verify documents from the checklist and add internal notes.
          </p>
        </Card>

        <Card className="p-4 bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-900 mb-2">3️⃣ Retrieved Status</h3>
          <p className="text-green-800">
            Click "Retrieved" to move the ticket to its service-specific queue. Tellers can then call the customer.
          </p>
        </Card>
      </div>

      {/* Role Restrictions Info */}
      <Card className="mt-6 p-4 border-gray-300">
        <h3 className="font-semibold mb-3">🔐 Archiver Role Restrictions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-green-700 mb-2">✅ Archiver CAN:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Claim tickets from Global repository</li>
              <li>• Prepare and verify documents</li>
              <li>• Add internal notes</li>
              <li>• Release tickets to service queues</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-700 mb-2">❌ Archiver CANNOT:</h4>
            <ul className="space-y-1 text-gray-700">
              <li>• Call or serve customers</li>
              <li>• See teller windows</li>
              <li>• Complete cases</li>
              <li>• Transfer to employees</li>
            </ul>
          </div>
        </div>
      </Card>
    </ConsoleShell>
  );
}
