import { Pressable, Text, View } from "react-native";
import { useTheme } from "./theme";
import { useStyles } from "./styles";

export function WalkthroughScreen({ onClose }: { projectId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  return (
    <View style={styles.pad}>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={styles.link}>‹ Job</Text>
      </Pressable>
      <Text style={styles.title}>Video walkthrough</Text>
      <Text style={styles.help}>Recording runs on the phone. This browser view can review jobs and messages.</Text>
    </View>
  );
}
