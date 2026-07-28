/**
 * Usuarios QA de Propie, uno por rol. Cada rol tiene navegación y contenido de
 * perfil distintos (ver docs/TEST-STRATEGY.md §3), así que son la base del
 * testing data-driven de navegación y permisos.
 */
export type Role = 'client' | 'owner' | 'agent';

export interface User {
  email: string;
  password: string;
  role: Role;
  /** Etiqueta de rol tal como se muestra en /perfil. */
  roleLabel: string;
  description: string;
}

/**
 * Nombre de la variable de entorno con la contraseña de las cuentas QA.
 * Se centraliza para que el mensaje de error de `auth.setup.ts` y la
 * documentación no se desincronicen del código.
 */
export const PASSWORD_ENV_VAR = 'PROPIE_QA_PASSWORD';

/**
 * Contraseña común de los 3 usuarios QA.
 *
 * Se lee del entorno y **nunca se versiona**: este repositorio es público y
 * las cuentas apuntan a un sitio realmente desplegado, así que una contraseña
 * en el código sería una credencial funcional al alcance de cualquiera.
 *
 * Configurarla en un archivo `.env` local (ver `.env.example`). Si falta,
 * `auth.setup.ts` corta la ejecución con un mensaje explícito en vez de dejar
 * que los tests fallen con un timeout de login que no explica nada.
 */
export const PASSWORD = process.env[PASSWORD_ENV_VAR] ?? '';

export const USERS = {
  client: {
    email: 'qa.client@propie.app',
    password: PASSWORD,
    role: 'client',
    roleLabel: 'Explorador',
    description: 'Busca y visita propiedades. Nav: Explorar, Favoritos, Visitas, Mensajes, Perfil.',
  },
  owner: {
    email: 'qa.owner@propie.app',
    password: PASSWORD,
    role: 'owner',
    roleLabel: 'Propietario',
    description: 'Publica propiedades propias. Nav: Explorar, Publicar, Mis Props., Mensajes, Perfil.',
  },
  agent: {
    email: 'qa.agent@propie.app',
    password: PASSWORD,
    role: 'agent',
    roleLabel: 'Agente',
    description: 'Gestiona propiedades de terceros. Misma nav que Propietario; perfil con reputación/reseñas.',
  },
} as const satisfies Record<Role, User>;

/** Un storageState por rol: los 3 roles no pueden compartir sesión. */
export const STORAGE_STATE: Record<Role, string> = {
  client: '.auth/client.json',
  owner: '.auth/owner.json',
  agent: '.auth/agent.json',
};

export const INVALID_LOGIN = {
  wrongPassword: { email: USERS.client.email, password: 'wrong_pass' },
} as const;
