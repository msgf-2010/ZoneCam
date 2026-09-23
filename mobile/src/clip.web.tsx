import { Linking, Pressable, Text, View } from "react-native";

export function VideoTile({ uri }: { id: string; uri: string }) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(uri)}
      accessibilityRole="button"
      accessibilityLabel="Play video"
      style={{
        width: 168,
        height: 112,
        borderRadius: 12,
        backgroundColor: "#10262c",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, marginLeft: 2 }}>▶</Text>
      </View>
    </Pressable>
  );
}
