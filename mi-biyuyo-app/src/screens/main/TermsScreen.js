import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { Screen, Header, Txt, Card } from "../../components/ui";
import { LEGAL_SECTIONS, LEGAL_UPDATED } from "../../utils/legalText";

/** Términos de uso, pagos, reembolsos y privacidad. */
export default function TermsScreen({ navigation }) {
  const { colors } = useTheme();
  return (
    <Screen data={false} contentStyle={{ gap: 12, paddingTop: 16 }}>
      <Header title="Términos y reembolsos" onBack={() => navigation.goBack()} />
      <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
        Actualizado en {LEGAL_UPDATED}
      </Txt>
      {LEGAL_SECTIONS.map((s) => (
        <Card key={s.title} style={{ gap: 6 }}>
          <Txt style={{ fontSize: 15, fontWeight: "700" }}>{s.title}</Txt>
          {s.body.map((p, i) => (
            <Txt
              key={i}
              style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}
            >
              {p}
            </Txt>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
