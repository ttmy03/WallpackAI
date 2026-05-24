import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import type { UserSettings } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { updateFirestoreUserSettings } from "@/lib/firestore/users";

const userSettingsSchema = z.object({
  defaultAiDisclosure: z.boolean()
});

export async function GET(request: Request) {
  const auth = await requireAppUser(request, "reading settings");

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(ok(userToSettings(auth.firestoreUser)));
}

export async function PATCH(request: Request) {
  const auth = await requireAppUser(request, "updating settings");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json();
  const parsed = userSettingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Settings input is invalid.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  const user = await updateFirestoreUserSettings(
    auth.firestoreUser.id,
    parsed.data
  );

  return NextResponse.json(ok(userToSettings(user)));
}

function userToSettings(user: {
  email: string | null;
  name: string | null;
  defaultAiDisclosure: boolean;
}): UserSettings {
  return {
    email: user.email,
    name: user.name,
    defaultAiDisclosure: user.defaultAiDisclosure
  };
}
