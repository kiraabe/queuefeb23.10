import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Terms = () => {
  return (
    <div className="container py-10 max-w-4xl mx-auto px-4">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
          <p className="text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="px-0 space-y-6 text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Agreement to Terms</h2>
            <p>
              By accessing or using the Queue Management System, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Use of Service</h2>
            <p>
              This system is provided for public and internal use to manage service queues efficiently. Users must provide accurate information when requested and follow the designated queue procedures.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Prohibited Activities</h2>
            <p>
              You agree not to engage in any of the following prohibited activities:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Attempting to interfere with the system's ticket generation logic</li>
              <li>Providing false identity or misinformation</li>
              <li>Bypassing the queue sequence through unauthorized means</li>
              <li>Using the system for any purpose other than its intended queue management function</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. System Availability</h2>
            <p>
              While we strive to maintain consistent system availability, we do not guarantee that the service will be uninterrupted or error-free. We reserve the right to suspend or modify the service at any time without notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
            <p>
              In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the service.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Terms;
