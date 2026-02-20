import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { JobTitle } from "@shared/api";
import { toast } from "sonner";

function ProfileContent({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: jobTitles } = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/job-titles");
      if (!response.ok) throw new Error("Failed to fetch job titles");
      const result = (await response.json()) as { jobTitles: JobTitle[] };
      return result.jobTitles;
    },
  });

  const jobTitle = jobTitles?.find((jt) => jt.id === user.jobTitleId);

  const getInitials = (fullName?: string, username?: string): string => {
    const name = fullName || username;
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(user.fullName, user.username);

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-border/40 bg-background/95">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-semibold">My Profile</h1>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Profile Header Card */}
        <Card className="mb-8 border-border/60 bg-card/90 shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0">
                <AvatarFallback className="text-lg sm:text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-2xl sm:text-3xl truncate">
                  {user.fullName || user.username}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base capitalize mt-2">
                  {user.role === "employee" || user.role === "archiever"
                    ? "Staff Member"
                    : user.role === "teller"
                      ? "Teller"
                      : user.role === "reception"
                        ? "Reception Staff"
                        : "Administrator"}
                </CardDescription>
                {jobTitle && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {jobTitle.nameEnglish}
                    {jobTitle.nameAmharic && ` / ${jobTitle.nameAmharic}`}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Account Information */}
        <Card className="border-border/60 bg-card/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Full Name */}
            {user.fullName && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Full Name
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={user.fullName}
                    className="bg-muted/50 cursor-default"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(user.fullName!, "Full Name")}
                    className="h-10 w-10 flex-shrink-0"
                  >
                    {copiedField === "Full Name" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Username
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={user.username}
                  className="bg-muted/50 cursor-default"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(user.username, "Username")}
                  className="h-10 w-10 flex-shrink-0"
                >
                  {copiedField === "Username" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>


            {/* Role */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Role
              </Label>
              <Input
                readOnly
                value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                className="bg-muted/50 cursor-default"
              />
            </div>

            {/* Available Roles */}
            {user.roles && user.roles.length > 1 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Available Roles
                </Label>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <div
                      key={role}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize"
                    >
                      {role}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Window ID (for tellers) */}
            {user.windowId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Assigned Window
                </Label>
                <Input
                  readOnly
                  value={`Window ${user.windowId}`}
                  className="bg-muted/50 cursor-default"
                />
              </div>
            )}

          </CardContent>
        </Card>

        {/* Contact & Job Information */}
        <Card className="mt-8 border-border/60 bg-card/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Contact & Job Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Phone
                </Label>
                <Input
                  readOnly
                  value={user.phone || "Not provided"}
                  className="bg-muted/50 cursor-default"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  readOnly
                  value={user.email || "Not provided"}
                  className="bg-muted/50 cursor-default"
                />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Department
                </Label>
                <Input
                  readOnly
                  value={user.department || "Not provided"}
                  className="bg-muted/50 cursor-default"
                />
              </div>

              {/* Job Title */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Job Title
                </Label>
                <Input
                  readOnly
                  value={jobTitle?.nameEnglish || jobTitle?.nameAmharic || "Not provided"}
                  className="bg-muted/50 cursor-default"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="mt-8 border-border/60 bg-card/90 shadow-lg border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                To change your password or update account details, please
                contact your administrator.
              </p>
              <p>
                Your account information is automatically synced with the
                system when you log in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loading...</p>
        </div>
      </div>
    );
  }

  return <ProfileContent user={user} />;
}
