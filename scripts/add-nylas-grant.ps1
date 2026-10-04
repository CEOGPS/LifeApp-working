$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root 'src\pages\integrations\IntegrationsPanel.tsx'
if (-not (Test-Path $path)) { throw "Not found: $path" }
$s = [IO.File]::ReadAllText($path)
if ($s.Contains('NYLAS GRANT ID')) {
  Write-Host 'Nylas grant field is already in IntegrationsPanel.tsx'
  exit 0
}
$s = $s.Replace(@'
    passphrase?: string,
    confirmPassphrase?: string
  ): Promise<boolean> => {
'@, @'
    passphrase?: string,
    confirmPassphrase?: string,
    grant?: string
  ): Promise<boolean> => {
'@)
$s = $s.Replace(@'
      void refreshHealth([serviceIdOf(name)], true); // PATCH (api-key-wiring)
      return true;
'@, @'
      if (name === "Nylas" && grant?.trim()) {
        await saveCredential(user.id, {
          user_email: user.email,
          integration_name: "Nylas Grant",
          email: accountLabel,
          api_key: grant.trim(),
          status: "on",
          label: "grant",
        });
      }
      void refreshHealth([serviceIdOf(name)], true); // PATCH (api-key-wiring)
      return true;
'@)
$s = $s.Replace(@'
          onSaveKey={(label, key, passphrase, confirmPassphrase) =>
            addApiKey(modalFor, label, key, passphrase, confirmPassphrase)
          }
'@, @'
          onSaveKey={(label, key, passphrase, confirmPassphrase, grant) =>
            addApiKey(modalFor, label, key, passphrase, confirmPassphrase, grant)
          }
'@)
$s = $s.Replace(@'
    passphrase?: string,
    confirmPassphrase?: string
  ) => Promise<boolean>;
'@, @'
    passphrase?: string,
    confirmPassphrase?: string,
    grant?: string
  ) => Promise<boolean>;
'@)
$s = $s.Replace(@'
  const [key, setKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
'@, @'
  const [key, setKey] = useState("");
  const [grant, setGrant] = useState("");
  const [passphrase, setPassphrase] = useState("");
'@)
$s = $s.Replace(@'
        needsPassphrase ? passphrase : undefined,
        needsPassphrase && needsConfirm ? confirmPassphrase : undefined
      )
'@, @'
        needsPassphrase ? passphrase : undefined,
        needsPassphrase && needsConfirm ? confirmPassphrase : undefined,
        name === "Nylas" ? grant : undefined
      )
'@)
$s = $s.Replace(@'
                placeholder="sk-…"
                className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
              />
            </div>
          )}
'@, @'
                placeholder="sk-…"
                className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
              />
            </div>
          )}

          {mode === "apikey" && name === "Nylas" && (
            <div>
              <label className="text-[9px] font-display tracking-wider block mb-1" style={{ color: "hsl(var(--teal))" }}>
                NYLAS GRANT ID
              </label>
              <input
                value={grant}
                onChange={(e) => setGrant(e.target.value)}
                placeholder="Grant id for this mailbox"
                className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
              />
              <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                From the Nylas dashboard for the connected mailbox. Saved separately from the API key.
              </p>
            </div>
          )}
'@)
$s = $s.Replace(@'
                ? !key.trim() ||
                  starting ||
'@, @'
                ? !key.trim() ||
                  (name === "Nylas" && !grant.trim()) ||
                  starting ||
'@)
if (-not $s.Contains('NYLAS GRANT ID')) { throw 'Patch did not apply. IntegrationsPanel.tsx did not match.' }
[IO.File]::WriteAllText($path, $s)
Write-Host 'Added Nylas grant id field.'
