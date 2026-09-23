import NetInfo from "@react-native-community/netinfo";

export function watchConnection(onConnected: () => void) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) onConnected();
  });
}
