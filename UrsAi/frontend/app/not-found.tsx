import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="container flex min-h-screen flex-col items-center justify-center text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            404
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Page not found
          </h1>
          <p className="mt-3 max-w-md text-base text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Button asChild className="mt-8">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </body>
    </html>
  );
}
