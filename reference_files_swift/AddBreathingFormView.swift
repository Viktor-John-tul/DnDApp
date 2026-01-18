import SwiftUI

struct AddBreathingFormView: View {
    @Environment(\.dismiss) var dismiss
    var onSave: (BreathingForm) -> Void
    
    @State private var name = ""
    @State private var description = ""
    @State private var requiresAttack = true
    @State private var durationRounds = 0 // Matches the struct
    @State private var diceCount = 1
    @State private var diceFace = 6
    @State private var type: FormEffectType = .damage
    
    let diceOptions = [4, 6, 8, 10, 12, 20]
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Form Details") {
                    TextField("Name (e.g. First Form)", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                }
                
                Section("Mechanics") {
                    Toggle("Requires Attack Roll?", isOn: $requiresAttack)
                    
                    Stepper(value: $durationRounds, in: 0...10) {
                        HStack {
                            Text("Duration")
                            Spacer()
                            if durationRounds == 0 {
                                Text("Instant").foregroundStyle(.secondary)
                            } else {
                                Text("\(durationRounds) Rounds").bold()
                            }
                        }
                    }
                }
                
                Section("Dice & Effects") {
                    Picker("Effect Type", selection: $type) {
                        ForEach(FormEffectType.allCases, id: \.self) { t in
                            Text(t.rawValue).tag(t)
                        }
                    }
                    .pickerStyle(.menu) // Menu style handles many options better
                    
                    HStack {
                        Text("Dice Amount")
                        Spacer()
                        Stepper("", value: $diceCount, in: 1...20)
                        Text("\(diceCount)").bold()
                    }
                    
                    Picker("Dice Face", selection: $diceFace) {
                        ForEach(diceOptions, id: \.self) { face in
                            Text("d\(face)").tag(face)
                        }
                    }
                }
            }
            .navigationTitle("New Breathing Form")
            .toolbar {
                Button("Save") {
                    let newForm = BreathingForm(
                        name: name,
                        description: description,
                        requiresAttackRoll: requiresAttack,
                        durationRounds: durationRounds, // Matches struct
                        diceCount: diceCount,
                        diceFace: diceFace,
                        effectType: type
                    )
                    onSave(newForm)
                    dismiss()
                }
                .disabled(name.isEmpty)
            }
        }
    }
}
