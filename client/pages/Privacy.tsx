import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Privacy = () => {
  return (
    <div className="container py-10 max-w-4xl mx-auto px-4">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
          <p className="text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="px-0 space-y-6 text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p>
              Welcome to our Queue Management System. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you use our system.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Data We Collect</h2>
            <p>
              When you use our system to take a ticket or manage services, we may collect minimal personal information such as:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Full Name (for ticket identification)</li>
              <li>Woreda/Location information</li>
              <li>Service interests and category selections</li>
              <li>Ticket status and history</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Data</h2>
            <p>
              We use the collected information solely for providing and managing queue services, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Generating and tracking service tickets</li>
              <li>Notifying you of your turn in the queue</li>
              <li>Analyzing service performance and wait times</li>
              <li>Improving our overall service delivery</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. Access to your personal data is limited to employees and administrators who have a business need to know.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our privacy practices, please contact the system administrator.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Privacy;
