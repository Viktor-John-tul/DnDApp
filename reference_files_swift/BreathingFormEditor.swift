import SwiftUI

struct BreathingFormEditor: View {
    @Binding var form: BreathingForm
    @Environment(\.dismiss) var dismiss

    var body: some View {
        // We use a VStack instead of a Form to control spacing tightly
        VStack(alignment: .leading, spacing: 16) {
            
            // Header with Done button
            HStack {
                Text("Edit Technique")
                    .font(.headline)
                Spacer()
                Button("Done") { dismiss() }
                    .bold()
            }
            .padding(.bottom, 8)
            
            // --- SECTION 1: DETAILS ---
            VStack(alignment: .leading, spacing: 8) {
                Text("FORM DETAILS").font(.caption).foregroundStyle(.secondary)
                
                TextField("Form Name (e.g. Water Wheel)", text: $form.name)
                    .textFieldStyle(.roundedBorder)
                
                // Reduced line limit to save vertical space
                TextField("Description/Flavor Text", text: $form.description, axis: .vertical)
                    .lineLimit(3)
                    .textFieldStyle(.roundedBorder)
                    .font(.callout)
            }
            
            Divider()
            
            // --- SECTION 2: MECHANICS ---
            VStack(alignment: .leading, spacing: 10) {
                Text("EFFECT MECHANICS").font(.caption).foregroundStyle(.secondary)
                
                // Picker: Segmented style usually fits best horizontally
                Picker("Effect Type", selection: $form.effectType) {
                    ForEach(FormEffectType.allCases, id: \.self) { type in
                        // Using minimumScaleFactor ensures text shrinks slightly before cutting off
                        Text(type.rawValue).tag(type)
                            .minimumScaleFactor(0.8)
                            .lineLimit(1)
                    }
                }
                .pickerStyle(.segmented)
                
                // Logic based on what effect you picked
                if form.effectType == .damage || form.effectType == .attackBuff {
                    // COMPACT DICE CONTROL PANEL
                    HStack {
                        Text(form.effectType == .damage ? "Damage Roll:" : "Bonus Roll:")
                            .font(.subheadline)
                        
                        Spacer()
                        
                        // Grouping the pickers together visually
                        HStack(spacing: 0) {
                            Picker("", selection: $form.diceCount) {
                                ForEach(1...10, id: \.self) { num in Text("\(num)").tag(num) }
                            }
                            .labelsHidden()
                            .frame(maxWidth: 50)
                            
                            Text("d")
                                .font(.headline)
                                .foregroundStyle(.secondary)
                            
                            Picker("", selection: $form.diceFace) {
                                Text("4").tag(4); Text("6").tag(6); Text("8").tag(8)
                                Text("10").tag(10); Text("12").tag(12); Text("20").tag(20)
                            }
                            .labelsHidden()
                            .frame(maxWidth: 50)
                        }
                        .padding(4)
                        // A subtle background to make it look like one unit
                        .background(Color(UIColor.tertiarySystemFill))
                        .cornerRadius(8)
                    }
                    .padding(10)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(10)
                    
                    if form.effectType == .attackBuff {
                        HStack {
                            Text("Buff Duration:")
                            Spacer()
                            Stepper("\(form.durationRounds) Rounds", value: $form.durationRounds, in: 1...10)
                                .labelsHidden()
                            Text("\(form.durationRounds) Rds").bold()
                        }
                        .padding(10)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(10)
                    }
                    
                } else if form.effectType == .utility || form.effectType == .defenseBuff {
                    // COMPACT DURATION CONTROL
                    HStack {
                        Text("Duration:")
                        Spacer()
                        Stepper("\(form.durationRounds) Rounds", value: $form.durationRounds, in: 1...10)
                            .labelsHidden()
                        Text("\(form.durationRounds) Rds")
                            .bold()
                    }
                    .padding(10)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(10)
                }
            }
            
            Spacer()
            
            // Preview at the bottom
            HStack {
                Image(systemName: "sparkles")
                Text(previewText)
                Spacer()
            }
            .font(.footnote)
            .foregroundStyle(.orange)
            .padding()
            .background(Color.orange.opacity(0.1))
            .cornerRadius(10)
        }
        .padding()
        // Important: removes the default navigation bar space since we made our own header
        .toolbar(.hidden, for: .navigationBar)
    }
    
    // Helper for the preview text at the bottom
    var previewText: String {
        switch form.effectType {
        case .damage: return "Deals \(form.diceCount)d\(form.diceFace) damage."
        case .attackBuff: return "Adds +\(form.diceCount)d\(form.diceFace) to damage rolls for \(max(form.durationRounds, 1)) rounds."
        case .defenseBuff: return "Adds +\(form.durationRounds) to AC for \(form.durationRounds) rounds."
        case .utility: return "See description. Lasts \(form.durationRounds) rounds."
        }
    }
}
