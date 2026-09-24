import { useEffect, useState } from "react";
import { BackHandler, Image, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, getApiBase } from "./api";
import { CaptureScreen } from "./capture";
import { VideoTile } from "./clip";
import { listQueue, type QueueRow } from "./queue";
import { WalkthroughScreen } from "./walkthrough";
import { FIELD_PHOTO_CATEGORIES, absoluteUrl, directionsUrl, jobAddress, type FieldJob, type FieldSession } from "./field";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

type Place =
  | { name: "jobs" }
  | { name: "job"; id: string }
  | { name: "messages"; id: string }
  | { name: "category"; id: string; category: string }
  | { name: "camera"; id: string; number: string; jobName: string; category: string; note: string }
  | { name: "walk"; id: string };

type JobMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | null;
  author?: { firstName: string; lastName: string } | null;
};

export function FieldHome({ session, onLogout }: { session: FieldSession; onLogout: () => void }) {
  const [place, setPlace] = useState<Place>({ name: "jobs" });

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (place.name === "camera") {
        setPlace({ name: "category", id: place.id, category: place.category });
        return true;
      }
      if (place.name === "walk" || place.name === "category" || place.name === "messages") {
        setPlace({ name: "job", id: place.id });
        return true;
      }
      if (place.name === "job") {
        setPlace({ name: "jobs" });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [place]);

  if (place.name === "camera") {
    return (
      <CaptureScreen
        project={{ id: place.id, name: place.jobName, number: place.number }}
        category={place.category}
        description={place.note}
        onClose={() => setPlace({ name: "category", id: place.id, category: place.category })}
      />
    );
  }
  if (place.name === "walk") {
    return <WalkthroughScreen projectId={place.id} onClose={() => setPlace({ name: "job", id: place.id })} />;
  }
  if (place.name === "category") {
    return (
      <CategoryScreen
        session={session}
        projectId={place.id}
        category={place.category}
        onBack={() => setPlace({ name: "job", id: place.id })}
        onCamera={(job, note) =>
          setPlace({
            name: "camera",
            id: place.id,
            number: job.number,
            jobName: job.name,
            category: place.category,
            note,
          })
        }
      />
    );
  }
  if (place.name === "messages") {
    return <MessagesScreen session={session} projectId={place.id} onBack={() => setPlace({ name: "job", id: place.id })} />;
  }
  if (place.name === "job") {
    return (
      <JobScreen
        session={session}
        projectId={place.id}
        onBack={() => setPlace({ name: "jobs" })}
        onCategory={(category) => setPlace({ name: "category", id: place.id, category })}
        onWalk={() => setPlace({ name: "walk", id: place.id })}
        onMessages={() => setPlace({ name: "messages", id: place.id })}
      />
    );
  }
  return <JobsScreen session={session} onLogout={onLogout} onOpen={(id) => setPlace({ name: "job", id })} />;
}

function MediaPreview({ uri, onClose }: { uri: string; onClose: () => void }) {
  const styles = useStyles(useTheme().colors);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.previewBackdrop}>
        <Pressable onPress={onClose} style={styles.previewClose} hitSlop={12}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Close</Text>
        </Pressable>
        <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

function LocalShot({ row }: { row: QueueRow }) {
  const styles = useStyles(useTheme().colors);
  const [open, setOpen] = useState(false);
  if (row.mimeType.startsWith("video")) {
    return <VideoTile id={row.id} uri={row.localUri} />;
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Preview photo">
        <Image source={{ uri: row.localUri }} style={styles.thumb} />
      </Pressable>
      {open ? <MediaPreview uri={row.localUri} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ServerShot({
  item,
  base,
}: {
  item: { id: string; type?: string; urls?: { thumbnail?: string; original?: string } };
  base: string;
}) {
  const styles = useStyles(useTheme().colors);
  const [open, setOpen] = useState(false);
  if (item.type === "video" && item.urls?.original) {
    return <VideoTile id={item.id} uri={absoluteUrl(base, item.urls.original)} />;
  }
  const thumb = item.urls?.thumbnail ? absoluteUrl(base, item.urls.thumbnail) : "";
  const full = item.urls?.original ? absoluteUrl(base, item.urls.original) : thumb;
  if (!thumb) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Preview photo">
        <Image source={{ uri: thumb }} style={styles.thumb} />
      </Pressable>
      {open ? <MediaPreview uri={full} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ThemeSwitch() {
  const { name, colors, setName } = useTheme();
  const styles = useStyles(colors);
  const next = name === "dark" ? "light" : "dark";
  return (
    <Pressable onPress={() => setName(next)} hitSlop={8} style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}>
      <Text style={styles.themeToggleText}>{next === "light" ? "Light" : "Dark"}</Text>
    </Pressable>
  );
}

function JobsScreen({
  session,
  onOpen,
  onLogout,
}: {
  session: FieldSession;
  onOpen: (id: string) => void;
  onLogout: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [base, setBase] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canCreate =
    session.permissions?.includes("projects.create") ||
    session.role?.key === "owner" ||
    session.role?.key === "admin" ||
    session.role?.key === "manager" ||
    session.role?.key === "office";

  async function refresh() {
    const json = await api("/api/v1/projects?field=1");
    setJobs(json.data ?? []);
    setBase(await getApiBase());
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs"));
  }, []);

  const open = jobs.filter((job) => !job.projectStatus?.isTerminal);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = open.filter((job) => {
    if (!job.startDate) return false;
    const at = new Date(job.startDate).getTime();
    return at >= start.getTime() && at < end.getTime();
  });
  const rest = open.filter((job) => !today.some((row) => row.id === job.id));

  async function createJob() {
    setPending(true);
    setError(null);
    try {
      const json = await api("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          addressLine1: address || null,
          startDate: new Date().toISOString().slice(0, 10),
          projectStatusKey: "in_progress",
          memberIds: [session.user.id],
        }),
      });
      setName("");
      setAddress("");
      setAdding(false);
      if (json.data?.id) onOpen(json.data.id);
      else await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create job.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text style={styles.brand}>ZONECAM FIELD</Text>
          <Text style={styles.hello}>
            {session.user.firstName} · {session.company.name}
          </Text>
        </View>
        <View style={styles.topActions}>
          <ThemeSwitch />
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.title}>Your jobs</Text>
      <Text style={styles.help}>Open a job for photos, messages, and the video walkthrough.</Text>
      {canCreate && !adding ? (
        <Pressable style={({ pressed }) => [styles.addJob, pressed && styles.pressed]} onPress={() => setAdding(true)}>
          <Text style={styles.secondaryText}>+ Add a job</Text>
        </Pressable>
      ) : null}
      {canCreate && adding ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>New site</Text>
          <Text style={styles.help}>Name the job, then start shooting.</Text>
          <Text style={styles.label}>Job name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="123 Oak roof" placeholderTextColor={colors.faint} />
          <Text style={styles.label}>Address</Text>
          <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="Street, city" placeholderTextColor={colors.faint} />
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed, (pending || !name.trim()) && styles.disabled]}
            disabled={pending || !name.trim()}
            onPress={() => void createJob()}
          >
            <Text style={styles.buttonText}>{pending ? "Creating…" : "Start this job"}</Text>
          </Pressable>
          <Pressable onPress={() => setAdding(false)} style={styles.secondary}>
            <Text style={styles.secondaryText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.bannerDangerText}>{error}</Text> : null}
      {open.length === 0 && !canCreate ? <Text style={styles.empty}>No jobs on your list yet. Ask the office to assign you.</Text> : null}
      {today.length > 0 ? <Text style={styles.section}>Today</Text> : null}
      {today.map((job) => (
        <JobCard key={job.id} job={job} base={base} onOpen={onOpen} />
      ))}
      {rest.length > 0 ? <Text style={styles.section}>{today.length ? "Other open jobs" : "Open jobs"}</Text> : null}
      {rest.map((job) => (
        <JobCard key={job.id} job={job} base={base} onOpen={onOpen} />
      ))}
    </ScrollView>
  );
}

function JobCard({ job, base, onOpen }: { job: FieldJob; base: string; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const address = jobAddress(job);
  const thumbs = job.thumbs ?? [];
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => onOpen(job.id)}>
      {thumbs.length > 0 ? (
        <View style={styles.photoRow}>
          {thumbs.map((thumb) => (
            <Image key={thumb.id} source={{ uri: absoluteUrl(base, thumb.url) }} style={styles.thumb} />
          ))}
        </View>
      ) : (
        <View style={styles.thumbEmpty}>
          <Text style={styles.muted}>No photos yet</Text>
        </View>
      )}
      <Text style={styles.kicker}>
        {job.number} · {job.photoCount ?? 0} photo{(job.photoCount ?? 0) === 1 ? "" : "s"}
      </Text>
      <Text style={styles.cardTitle}>{job.name}</Text>
      <Text style={styles.muted}>
        {job.customer?.name ?? "No customer"}
        {address ? ` · ${address}` : ""}
      </Text>
      {job.projectStatus?.name ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{job.projectStatus.name}</Text>
        </View>
      ) : null}
      {job.lastMessage ? <Text style={styles.muted}>{job.lastMessage}</Text> : null}
    </Pressable>
  );
}

function JobScreen({
  session,
  projectId,
  onBack,
  onCategory,
  onWalk,
  onMessages,
}: {
  session: FieldSession;
  projectId: string;
  onBack: () => void;
  onCategory: (category: string) => void;
  onWalk: () => void;
  onMessages: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [job, setJob] = useState<FieldJob | null>(null);
  const [base, setBase] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState<Array<{ id: string; type?: string; urls?: { thumbnail?: string; original?: string } }>>([]);
  const [localShots, setLocalShots] = useState<QueueRow[]>([]);

  async function refresh() {
    const [projectJson, commentsJson, mediaJson, apiBase, queued] = await Promise.all([
      api(`/api/v1/projects/${projectId}`),
      api(`/api/v1/projects/${projectId}/comments`),
      api(`/api/v1/projects/${projectId}/media`),
      getApiBase(),
      listQueue(projectId),
    ]);
    const known = new Set(queued.map((row) => row.serverMediaId).filter((id): id is string => Boolean(id)));
    setJob(projectJson.data);
    setMessages(commentsJson.data ?? []);
    setPhotos((mediaJson.data?.items ?? []).filter((item: { id: string }) => !known.has(item.id)));
    setLocalShots(queued);
    setBase(apiBase);
    const tagged = await Promise.all(
      FIELD_PHOTO_CATEGORIES.map(async (category) => {
        const json = await api(`/api/v1/projects/${projectId}/media?tag=${encodeURIComponent(category.key)}`);
        return [category.key, (json.data?.items ?? []).length] as const;
      }),
    );
    setCounts(Object.fromEntries(tagged));
  }

  useEffect(() => {
    refresh().catch(() => setStatus("Could not load this job."));
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 12000);
    return () => clearInterval(timer);
  }, [projectId]);

  const address = job ? jobAddress(job) : "";
  const maps = job ? directionsUrl(job) : null;
  const statusKey = job?.projectStatus?.key ?? "";
  const terminal = Boolean(job?.projectStatus?.isTerminal) || statusKey === "completed" || statusKey === "cancelled";
  const canRun = (session.permissions?.includes("projects.edit") ?? false) || session.role?.key === "field_technician";

  async function post(path: string) {
    setPending(true);
    try {
      await api(path, { method: "POST" });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update the job.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.link}>‹ Your jobs</Text>
        </Pressable>
        <ThemeSwitch />
      </View>
      <Text style={styles.title}>{job?.name ?? "Job"}</Text>
      <Text style={styles.help}>
        {job?.number}
        {address ? ` · ${address}` : ""}
      </Text>
      {photos.length > 0 || localShots.length > 0 ? (
        <View style={styles.photoRow}>
          {localShots.map((row) => (
            <LocalShot key={row.id} row={row} />
          ))}
          {photos.slice(0, 8).map((item) => (
            <ServerShot key={item.id} item={item} base={base} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No photos on this job yet. Pick a category below.</Text>
      )}
      <View style={styles.actions}>
        {maps ? (
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => void Linking.openURL(maps)}>
            <Text style={styles.secondaryText}>Navigate</Text>
          </Pressable>
        ) : null}
        {canRun && !terminal ? (
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} disabled={pending} onPress={() => void post(`/api/v1/projects/${projectId}/complete`)}>
            <Text style={styles.secondaryText}>Complete job</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable style={({ pressed }) => [styles.walkCard, pressed && styles.pressed]} onPress={onWalk}>
        <Text style={styles.kicker}>Office checklist</Text>
        <Text style={styles.cardTitle}>Video walkthrough</Text>
        <Text style={styles.muted}>Record video and notes. The office gets a trade list.</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.walkCard, pressed && styles.pressed]} onPress={onMessages}>
        <Text style={styles.section}>Job messages</Text>
        {messages.length === 0 ? <Text style={styles.empty}>No messages yet. Notes you send, and replies from the office, show up here.</Text> : null}
        {messages.slice(-2).map((row) => {
          const mine = row.authorId === session.user.id;
          return (
            <View key={row.id} style={mine ? styles.msgMine : styles.msgThem}>
              <Text style={[styles.msgWho, { color: mine ? colors.primaryInk : colors.ink }]}>
                {mine ? "You" : row.author ? `${row.author.firstName} ${row.author.lastName}` : "Office"}
              </Text>
              <Text style={{ color: mine ? colors.primaryInk : colors.ink }} numberOfLines={2}>
                {row.body}
              </Text>
            </View>
          );
        })}
        <Text style={styles.link}>{messages.length > 0 ? "Open messages" : "Message the office"}</Text>
      </Pressable>
      {status ? <Text style={styles.help}>{status}</Text> : null}
      <Text style={styles.section}>What are you documenting?</Text>
      <View style={styles.catGrid}>
        {FIELD_PHOTO_CATEGORIES.map((category) => (
          <Pressable key={category.key} style={({ pressed }) => [styles.catCard, pressed && styles.pressed]} onPress={() => onCategory(category.key)}>
            <View style={[styles.catDot, { backgroundColor: category.tone }]} />
            <Text style={styles.catName}>{category.name}</Text>
            <Text style={styles.catHint}>{category.hint}</Text>
            <Text style={styles.catCount}>{counts[category.key] ?? 0}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function MessagesScreen({ session, projectId, onBack }: { session: FieldSession; projectId: string; onBack: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    const json = await api(`/api/v1/projects/${projectId}/comments`);
    setMessages(json.data ?? []);
  }

  useEffect(() => {
    refresh().catch(() => setStatus("Could not load messages."));
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [projectId]);

  async function sendMessage() {
    setPending(true);
    setStatus(null);
    try {
      const json = await api(`/api/v1/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      setMessages((current) => [...current, json.data]);
      setDraft("");
      setStatus("Sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.link}>‹ Job</Text>
      </Pressable>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.help}>Anything you send goes to the office. Replies from the office show up on this phone.</Text>
      {messages.length === 0 ? <Text style={styles.empty}>No messages yet.</Text> : null}
      {messages.map((row) => {
        const mine = row.authorId === session.user.id;
        return (
          <View key={row.id} style={mine ? styles.msgMine : styles.msgThem}>
            <Text style={[styles.msgWho, { color: mine ? colors.primaryInk : colors.ink }]}>
              {mine ? "You" : row.author ? `${row.author.firstName} ${row.author.lastName}` : "Office"}
            </Text>
            <Text style={{ color: mine ? colors.primaryInk : colors.ink }}>{row.body}</Text>
            <Text style={[styles.muted, mine ? { color: colors.primaryInk } : null]}>{new Date(row.createdAt).toLocaleString()}</Text>
          </View>
        );
      })}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        style={styles.note}
        placeholder="Need material, access, or a decision?"
        placeholderTextColor={colors.faint}
      />
      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed, (pending || !draft.trim()) && styles.disabled]}
        disabled={pending || !draft.trim()}
        onPress={() => void sendMessage()}
      >
        <Text style={styles.secondaryText}>{pending ? "Sending…" : "Send to office"}</Text>
      </Pressable>
      {status ? <Text style={styles.help}>{status}</Text> : null}
    </ScrollView>
  );
}

function CategoryScreen({
  projectId,
  category,
  onBack,
  onCamera,
}: {
  session: FieldSession;
  projectId: string;
  category: string;
  onBack: () => void;
  onCamera: (job: FieldJob, note: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const meta = FIELD_PHOTO_CATEGORIES.find((item) => item.key === category);
  const [job, setJob] = useState<FieldJob | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [shots, setShots] = useState<Array<{ id: string; type?: string; urls?: { thumbnail?: string; original?: string } }>>([]);
  const [localShots, setLocalShots] = useState<QueueRow[]>([]);
  const [base, setBase] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    const [projectJson, mediaJson, apiBase, queued] = await Promise.all([
      api(`/api/v1/projects/${projectId}`),
      api(`/api/v1/projects/${projectId}/media?tag=${encodeURIComponent(category)}`),
      getApiBase(),
      listQueue(projectId),
    ]);
    const known = new Set(queued.map((row) => row.serverMediaId).filter((id): id is string => Boolean(id)));
    setJob(projectJson.data);
    setShots((mediaJson.data?.items ?? []).filter((item: { id: string }) => !known.has(item.id)));
    setLocalShots(queued.filter((row) => row.category === category));
    setBase(apiBase);
  }

  useEffect(() => {
    refresh().catch(() => setStatus("Could not load photos."));
  }, [projectId, category]);

  async function saveNote() {
    if (!note.trim()) return;
    setPending(true);
    try {
      await api(`/api/v1/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `${category}: ${note.trim()}`, visibility: "internal" }),
      });
      setNote("");
      setStatus("Note saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.link}>‹ Job</Text>
      </Pressable>
      <Text style={styles.title}>{meta?.name ?? category}</Text>
      <Text style={styles.help}>{meta?.hint}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => job && onCamera(job, note)}
      >
        <Text style={styles.buttonText}>Take photo</Text>
      </Pressable>
      <Text style={styles.label}>Note for the office</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.note}
        placeholder="Anything they should know about these shots…"
        placeholderTextColor={colors.faint}
      />
      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed, (pending || !note.trim()) && styles.disabled]}
        disabled={pending || !note.trim()}
        onPress={() => void saveNote()}
      >
        <Text style={styles.secondaryText}>Save note only</Text>
      </Pressable>
      {status ? <Text style={styles.help}>{status}</Text> : null}
      <Text style={styles.section}>
        {shots.length + localShots.length} in {category}
      </Text>
      {shots.length + localShots.length === 0 ? <Text style={styles.empty}>No photos in this category yet.</Text> : null}
      <View style={styles.photoRow}>
        {localShots.map((row) => (
          <LocalShot key={row.id} row={row} />
        ))}
        {shots.map((item) => (
          <ServerShot key={item.id} item={item} base={base} />
        ))}
      </View>
    </ScrollView>
  );
}
