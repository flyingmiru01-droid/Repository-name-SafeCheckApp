import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";

export default function SearchByName() {
  const [keyword, setKeyword] = useState("");

  function search() {
    console.log("搜尋姓名:", keyword);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>姓名查詢</Text>

      <TextInput
        style={styles.input}
        placeholder="輸入姓名"
        value={keyword}
        onChangeText={setKeyword}
      />

      <Pressable style={styles.button} onPress={search}>
        <Text style={styles.buttonText}>查詢</Text>
      </Pressable>

      <Text style={styles.notice}>
        本平台資料僅供安全參考，不代表司法認定或犯罪事實。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  notice: {
    marginTop: 20,
    fontSize: 12,
    color: "#666",
  },
});
