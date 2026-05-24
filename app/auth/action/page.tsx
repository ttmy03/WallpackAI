import { EmailActionHandler } from "@/components/auth/email-action-handler";

type EmailActionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmailActionPage({
  searchParams
}: EmailActionPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-md place-items-center px-4 py-12">
      <EmailActionHandler
        mode={firstParam(params.mode)}
        oobCode={firstParam(params.oobCode)}
        continueUrl={firstParam(params.continueUrl)}
      />
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
