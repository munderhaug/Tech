import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { NAV_ITEMS } from "@/app/nav";
import { Card, CardContent, SectionTitle } from "@/components/ui/primitives";

export function MorePage() {
  // Secondary destinations not in the mobile bottom bar.
  const items = NAV_ITEMS.filter((i) => !i.primary);
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>More</SectionTitle>
      <div className="flex flex-col gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card>
              <CardContent className="flex items-center gap-3 p-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
