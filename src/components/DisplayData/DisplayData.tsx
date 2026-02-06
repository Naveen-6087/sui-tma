import type { FC, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/Link/Link";

export type DisplayDataRow = { title: string } & (
  | { type: "link"; value?: string }
  | { value: ReactNode }
);

export interface DisplayDataProps {
  header?: ReactNode;
  footer?: ReactNode;
  rows: DisplayDataRow[];
}

export const DisplayData: FC<DisplayDataProps> = ({ header, rows }) => (
  <Card>
    {header && (
      <CardHeader>
        <CardTitle>{header}</CardTitle>
      </CardHeader>
    )}
    <CardContent>
      <div className="space-y-4">
        {rows.map((item, idx) => {
          let valueNode: ReactNode;

          if (item.value === undefined) {
            valueNode = <i>empty</i>;
          } else {
            if ("type" in item) {
              valueNode = <Link href={item.value}>Open</Link>;
            } else if (typeof item.value === "string") {
              valueNode = item.value;
            } else if (typeof item.value === "boolean") {
              valueNode = item.value ? "Yes" : "No";
            } else {
              valueNode = item.value;
            }
          }

          return (
            <div
              key={idx}
              className="flex justify-between items-center py-2 border-b border-border last:border-b-0"
            >
              <span className="font-medium text-muted-foreground">
                {item.title}:
              </span>
              <span className="text-foreground">{valueNode}</span>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);
