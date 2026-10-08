import {
  saveStudents,
  type OfflineStudent,
} from "./students";
import {
  saveLocalGateSession,
} from "./session";

export type GateBootstrapResponse = {
  success: boolean;

  scanner?: {
    id: string;
    name: string;
    role: "ADMIN" | "SCANNER";
  };

  event?: {
    name: string;
    entryEnabled: boolean;
    updatedAt: string | null;
  };

  generatedAt?: string;

  count?: number;

  students?: OfflineStudent[];

  error?: string;
};

export async function bootstrapGateDatabase() {
  const response = await fetch("/api/gate/bootstrap", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  let data: GateBootstrapResponse;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Gate server returned an invalid response."
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Scanner session expired. Please log in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "This account is not authorized to use the gate."
      );
    }

    throw new Error(
      data.error ||
        "Failed to download gate database."
    );
  }

  if (
    !data.success ||
    !Array.isArray(data.students)
  ) {
    throw new Error(
      data.error ||
        "Gate database response was invalid."
    );
  }

  await saveStudents(data.students);
if (data.scanner) {
  await saveLocalGateSession({
    id: data.scanner.id,
    name: data.scanner.name,
    role: data.scanner.role,
    authenticatedAt: new Date().toISOString(),
  });
}
  return {
    ...data,
    count: data.students.length,
  };
}