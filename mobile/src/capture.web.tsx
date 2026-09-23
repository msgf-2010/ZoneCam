import { Pressable, Text, View } from "react-native";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

type Project = {
  id: string;
  name: string;
  number: string;
};

export function CaptureScreen({ onClose }: { project: Project; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.pad}>
      <Text style={styles.title}>Camera</Text>
      <Text style={styles.help}>The camera runs in the phone app. This browser view is for signing in and reviewing jobs.</Text>
      <Pressable onPress={onClose} hitSlop={8} style={styles.secondary}>
        <Text style={styles.secondaryText}>Back</Text>
      </Pressable>
    </View>
  );
}
