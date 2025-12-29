import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WindowMonitoring from "./WindowMonitoring";
import WindowManagement from "./WindowManagement";
import TellerManagement from "./TellerManagement";
import ServiceManagement from "./ServiceManagement";
import { BarChart3, Users, MonitorPlay, Layers } from "lucide-react";

export default function AdminWindows() {
  return (
    <Tabs defaultValue="monitoring" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="monitoring" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Monitoring</span>
        </TabsTrigger>
        <TabsTrigger value="windows" className="flex items-center gap-2">
          <MonitorPlay className="h-4 w-4" />
          <span className="hidden sm:inline">Windows</span>
        </TabsTrigger>
        <TabsTrigger value="services" className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Services</span>
        </TabsTrigger>
        <TabsTrigger value="tellers" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Tellers</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="monitoring" className="space-y-4">
        <WindowMonitoring />
      </TabsContent>

      <TabsContent value="windows" className="space-y-4">
        <WindowManagement />
      </TabsContent>

      <TabsContent value="services" className="space-y-4">
        <ServiceManagement />
      </TabsContent>

      <TabsContent value="tellers" className="space-y-4">
        <TellerManagement />
      </TabsContent>
    </Tabs>
  );
}
